import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';
import { CollectDto, TrackDto } from './dto.js';

/* 수집은 외부 API(iTunes·Last.fm)를 몰아 부르므로 관리자만.
   관리자 = .env 의 ADMIN_EMAILS(쉼표로 여러 개). 비어 있으면 아무도 못 부른다 */
const isAdmin = (email: string) =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('tracks')
  @ApiOperation({ summary: '갖춰 둔 곡 목록' })
  @ApiResponse({ status: 200, type: [TrackDto] })
  list() {
    return this.catalog.list();
  }

  @Get('budget')
  @ApiOperation({ summary: '오늘 남은 유튜브 검색 횟수' })
  budget() {
    return this.catalog.budget();
  }

  @Post('collect')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '곡 정보 수집 (관리자) — 커버·미리듣기(iTunes) + 태그(Last.fm). 영상 ID 는 재생목록·밤 배치에서' })
  @ApiResponse({ status: 201, type: [TrackDto] })
  @ApiResponse({ status: 403, description: 'ADMIN_EMAILS 에 없는 계정' })
  collect(@Body() dto: CollectDto, @Req() req: { user: { email: string } }) {
    if (!isAdmin(req.user.email)) throw new ForbiddenException('수집은 관리자만 할 수 있네');
    return this.catalog.collectMany(dto.tracks, dto.force ?? false);
  }
}
