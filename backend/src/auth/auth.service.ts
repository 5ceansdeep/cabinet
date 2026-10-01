import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, SignupDto, TokenDto } from './dto.js';
import { Mailer } from './mail.js';

const MAX_RESETS = 5; // 열쇠 찾기 — 같은 곳에서 CHECK_MS 동안 이만큼만
const RESET_MS = 30 * 60 * 1000; // 재설정 링크 유효 시간
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** 재설정 메일 본문 — 신의 말투(docs/voice-persona.md) */
export const resetMail = (nickname: string, link: string) =>
  [
    `${nickname}, 열쇠를 잃어버렸다고?`,
    '',
    '새 열쇠를 깎아 두었네. 아래 링크를 열고 새 비밀을 정하게.',
    link,
    '',
    '30분이 지나면 이 열쇠는 맞지 않네. 자네가 부탁한 게 아니라면 그냥 두게 — 서랍은 그대로 잠겨 있으니.',
    '',
    '— 서류함에서',
  ].join('\n');

const MAX_FAILS = 5; // 이만큼 틀리면
const LOCK_MS = 15 * 60 * 1000; // 이 시간 동안 같은 곳(IP)에서 같은 이메일로는 못 들어온다
const MAX_CHECKS = 30; // 가입 여부 확인 — 같은 곳에서 CHECK_MS 동안 이만큼만
const CHECK_MS = 10 * 60 * 1000;

/* 서류함의 문지기 — 이름(이메일)과 열쇠(비밀번호)를 받아 출입증(JWT)을 내준다 */
@Injectable()
export class AuthService {
  // 비밀번호 마구 대입하기 막기 — IP+이메일마다 연속 실패 수.
  // IP 를 같이 보는 건, 남의 이메일로 일부러 틀려서 그 사람을 잠가 버리는 걸 막으려고.
  // ponytail: 서버 메모리라 재시작하면 풀리고 서버가 여러 대면 따로 센다 — 배포 규모가 커지면 Redis 나 @nestjs/throttler 로
  private readonly fails = new Map<string, { count: number; until: number }>();
  // 가입 여부 확인 횟수 — IP 마다. 남의 이메일을 대량으로 넣어 가입자 목록을 긁어 가지 못하게 (ponytail: 같은 메모리 한계)
  private readonly checks = new Map<string, { count: number; until: number }>();
  private readonly resets = new Map<string, { count: number; until: number }>(); // 열쇠 찾기 — IP 마다 (메일 폭탄 막기)
  private readonly log = new Logger('Auth');
  private readonly web: string; // 재설정 링크가 가리킬 화면 주소

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: Mailer,
    config: ConfigService,
  ) {
    this.web = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  }

  private issue(user: { id: string; email: string; nickname: string }): TokenDto {
    return {
      accessToken: this.jwt.sign({ sub: user.id, email: user.email }),
      user: { id: user.id, email: user.email, nickname: user.nickname },
    };
  }

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('그 주소는 이미 내 서랍에 있네');
    }
    const user = await this.prisma.user.create({
      data: { email, nickname: dto.nickname, password: await bcrypt.hash(dto.password, 10) },
    });
    return this.issue(user);
  }

  /** 회원가입 첫 칸에서 바로 — 이미 가입된 이메일인가. 가입 화면은 어차피 409 로 알려 주는 정보라 새로 흘리는 건 없다 */
  async checkEmail(email: string, ip = '') {
    const c = this.checks.get(ip);
    const now = Date.now();
    const count = c && now < c.until ? c.count + 1 : 1;
    this.checks.set(ip, { count, until: c && now < c.until ? c.until : now + CHECK_MS });
    if (count > MAX_CHECKS) throw new HttpException('천천히 하게. 잠깐 쉬었다 오게', HttpStatus.TOO_MANY_REQUESTS);
    return { taken: !!(await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })) };
  }

  async login(dto: LoginDto, ip = '') {
    const email = dto.email.trim().toLowerCase();
    const key = `${ip}|${email}`;
    const f = this.fails.get(key);
    if (f && f.count >= MAX_FAILS && Date.now() < f.until) {
      throw new HttpException('너무 여러 번 틀렸네. 잠깐 쉬었다 오게', HttpStatus.TOO_MANY_REQUESTS);
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    // 계정이 없을 때와 비밀번호가 틀렸을 때를 구분해 알려주지 않는다 — 누가 가입했는지 흘리지 않게
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      const count = f && Date.now() < f.until ? f.count + 1 : 1;
      this.fails.set(key, { count, until: Date.now() + LOCK_MS });
      throw new UnauthorizedException('비밀이 틀렸네');
    }
    this.fails.delete(key);
    return this.issue(user);
  }

  /* 열쇠 찾기 — 계정이 있으면 30분짜리 일회용 링크를 메일로. 있든 없든 같은 대답이라 누가 가입했는지 흘리지 않는다.
     메일은 기다리지 않는다(보내는 데 걸리는 시간으로 계정 유무가 드러나지 않게). 토큰 원문은 메일에만, DB 엔 sha256 만 */
  async forgot(email: string, ip = '') {
    const r = this.resets.get(ip);
    const now = Date.now();
    const count = r && now < r.until ? r.count + 1 : 1;
    this.resets.set(ip, { count, until: r && now < r.until ? r.until : now + CHECK_MS });
    if (count > MAX_RESETS) throw new HttpException('천천히 하게. 소포는 그렇게 자주 못 부치네', HttpStatus.TOO_MANY_REQUESTS);
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      await this.prisma.user.update({ where: { id: user.id }, data: { resetHash: sha256(token), resetUntil: new Date(now + RESET_MS) } });
      const link = `${this.web}/reset?token=${token}`;
      void this.mail
        .send(user.email, '[cabinet] 새 열쇠가 도착했네', resetMail(user.nickname, link))
        .catch((e) => this.log.warn(`재설정 메일 실패: ${e}`));
    }
    return { ok: true };
  }

  /** 메일의 링크로 새 비밀번호를 정한다 — 쓰면 링크는 끝나고, 바로 들어간다 */
  async reset(token: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { resetHash: sha256(token) } });
    if (!user || !user.resetUntil || user.resetUntil < new Date()) throw new BadRequestException('이 열쇠는 기한이 지났네');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(password, 10), resetHash: null, resetUntil: null },
    });
    return this.issue(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, nickname: user.nickname };
  }
}
