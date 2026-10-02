import { Body, Controller, HttpCode, Ip, Logger, Module, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Q_MAX } from './recommend/recommend.js';
import { PrismaService } from './prisma/prisma.service.js';
import { Limiter } from './recommend/recommend.js';

/* 행동 기록 — 화면이 재생·끝까지 들음·서랍 저장·공유·유튜브 이동 때 부른다(로그인 없이, 기다리지 않음). 실패해도 화면은 그대로.
   한 곳(IP)에서 분당 30·하루 1000건까지만 — 넘치면 조용히 버린다(DB 를 못 채우게) */

const logger = new Logger('Events');
const TYPES = ['play', 'finish', 'save', 'share', 'youtube'] as const;

class EventDto {
  @ApiProperty({ enum: TYPES }) @IsIn(TYPES) type!: (typeof TYPES)[number];
  @ApiProperty({ required: false, description: '곡 id — play·finish' }) @IsOptional() @IsString() @MaxLength(40) trackId?: string;
  @ApiProperty({ required: false, description: '서랍 id — save·share·youtube, 공개 서랍에서 튼 곡' }) @IsOptional() @IsString() @MaxLength(40) shelfId?: string;
  @ApiProperty({ required: false, description: '그 곡을 꺼낸 요청문 — play·finish' }) @IsOptional() @IsString() @MaxLength(Q_MAX) query?: string;
}

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}
  private readonly limiter = new Limiter(30, 1000);

  @Post()
  @HttpCode(204)
  @ApiOperation({ summary: '행동 하나 기록 — 재생엔 그 곡을 꺼낸 요청문을 같이. 사용자·IP 는 안 남긴다' })
  async log(@Body() dto: EventDto, @Ip() ip: string) {
    if (!this.limiter.hit(ip)) return;
    await this.prisma.eventLog.create({ data: { type: dto.type, trackId: dto.trackId, shelfId: dto.shelfId, query: dto.query?.trim() || null } }).catch((e) => logger.warn(`행동 기록 저장 실패: ${e}`));
  }
}

@Module({ controllers: [EventsController] })
export class EventsModule {}
