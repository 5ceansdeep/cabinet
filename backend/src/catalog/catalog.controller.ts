import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';
import { CollectDto, TrackDto } from './dto.js';

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

  @Get("budget")
  @ApiOperation({ summary: "오늘 남은 유튜브 검색 횟수" })
  budget() {
    return this.catalog.budget();
  }

  @Post("collect")
  @ApiOperation({ summary: '곡 정보 수집 — 커버·미리듣기(iTunes) + 유튜브 영상 ID(MusicBrainz)' })
  @ApiResponse({ status: 201, type: [TrackDto] })
  collect(@Body() dto: CollectDto) {
    return this.catalog.collectMany(dto.tracks, dto.force ?? false);
  }
}
