import { Body, Controller, Get, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto, MeDto, SignupDto, TokenDto } from './dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: '새 서랍 만들기 — 회원가입' })
  @ApiResponse({ status: 201, type: TokenDto })
  @ApiResponse({ status: 409, description: '이미 가입된 이메일' })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Post('login')
  @ApiOperation({ summary: '서랍 열기 — 로그인' })
  @ApiResponse({ status: 201, type: TokenDto })
  @ApiResponse({ status: 401, description: '이메일이나 비밀번호가 틀림' })
  @ApiResponse({ status: 429, description: '같은 곳에서 같은 이메일로 5번 틀림 — 15분 뒤에 다시' })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 정보' })
  @ApiResponse({ status: 200, type: MeDto })
  me(@Req() req: { user: { id: string } }) {
    return this.auth.me(req.user.id);
  }
}
