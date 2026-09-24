import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, SignupDto, TokenDto } from './dto.js';

/* 서류함의 문지기 — 이름(이메일)과 열쇠(비밀번호)를 받아 출입증(JWT)을 내준다 */
@Injectable()
export class AuthService {
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

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // 계정이 없을 때와 비밀번호가 틀렸을 때를 구분해 알려주지 않는다 — 누가 가입했는지 흘리지 않게
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('비밀이 틀렸네');
    }
    return this.issue(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, nickname: user.nickname };
  }
}
