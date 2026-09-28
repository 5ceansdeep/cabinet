import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, SignupDto, TokenDto } from './dto.js';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, nickname: user.nickname };
  }
}
