import { Body, Controller, Get, Module, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength } from 'class-validator';
import { PrismaService } from './prisma/prisma.service.js';

/* 좋아요 — 로그인한 사람이 곡에 누르는 하트. 추천(recommend.ts)이 그 사람이 좋아한 곡 결 쪽으로 조금 기울인다 */

class LikeDto {
  @ApiProperty({ description: '곡 id' }) @IsString() @MaxLength(40) trackId!: string;
  @ApiProperty({ description: 'true 좋아요, false 취소' }) @IsBoolean() on!: boolean;
}

@ApiTags('likes')
@Controller('likes')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class LikesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '내가 좋아요한 곡 id' })
  async mine(@Req() req: { user: { id: string } }) {
    const rows = await this.prisma.like.findMany({ where: { userId: req.user.id }, select: { trackId: true } });
    return rows.map((r) => r.trackId);
  }

  @Post()
  @ApiOperation({ summary: '좋아요 누르기·취소 — 이미 그 상태면 그대로' })
  async set(@Req() req: { user: { id: string } }, @Body() dto: LikeDto) {
    const key = { userId: req.user.id, trackId: dto.trackId };
    // 서류함에 없는 곡 id(서버 없이 도는 가짜 곡)는 조용히 버린다 — 화면은 그대로
    if (!dto.on) await this.prisma.like.deleteMany({ where: key });
    else if (await this.prisma.track.findUnique({ where: { id: dto.trackId }, select: { id: true } }))
      await this.prisma.like.upsert({ where: { userId_trackId: key }, create: key, update: {} });
    return { on: dto.on }; // 본문을 준다 — 화면의 api() 는 빈 응답(204)을 실패로 읽어 하트를 되돌린다
  }
}

@Module({ controllers: [LikesController] })
export class LikesModule {}
