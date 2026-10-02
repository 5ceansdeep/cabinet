import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { CatalogModule } from '../catalog/catalog.module.js';
import { searchUrl, VideoService, watchUrl } from '../catalog/videos.js';
import { PrismaService } from '../prisma/prisma.service.js';

/* 서랍 = 저장한 목록. 네임택과 그때의 요청문, 꽂힌 곡 순서를 남긴다 (DRIFT sectors 의 목록·저장·삭제 틀) */

class ShelfTrackDto {
  @ApiProperty({ example: 'Everything' }) @IsString() title!: string;
  @ApiProperty({ example: '검정치마' }) @IsString() artist!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() artwork?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() previewUrl?: string;
  @ApiProperty({ required: false, description: '그때 일치도 %(0~100) — 공유 카드 MATCH' }) @IsOptional() @IsInt() @Min(0) @Max(100) semantic?: number;
}

export class CreateShelfDto {
  @ApiProperty({ example: '#LATE-NIGHT' }) @IsString() @MinLength(1) @MaxLength(16) tag!: string;
  @ApiProperty({ example: '새벽에 혼자 걷는 기분', required: false }) @IsOptional() @IsString() @MaxLength(500) query?: string;
  @ApiProperty({ required: false, type: [String], description: '그때 요청 해석 — 공유 카드 MOOD' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  keywords?: string[];
  @ApiProperty({ type: [ShelfTrackDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ShelfTrackDto)
  tracks!: ShelfTrackDto[];
}

type Req = { user: { id: string } };

@Injectable()
export class ShelvesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly videos: VideoService,
  ) {}

  private readonly include = { tracks: { orderBy: { order: 'asc' as const }, include: { track: true } } };

  /* 곡 설명(description)은 보관함에서 디스크를 누르면 뜨는 카드에(10/2), keywords·semantic 은 공유 카드를 다시 그릴 때 */
  private toResponse(s: {
    id: string;
    tag: string;
    query: string;
    keywords: string;
    createdAt: Date;
    tracks: { semantic: number | null; track: { id: string; title: string; artist: string; artwork: string | null; previewUrl: string | null; description: string | null } }[];
  }) {
    return {
      id: s.id,
      tag: s.tag,
      query: s.query,
      keywords: JSON.parse(s.keywords) as string[],
      createdAt: s.createdAt.toISOString(),
      tracks: s.tracks.map(({ track: t, semantic }) => ({ id: t.id, title: t.title, artist: t.artist, artwork: t.artwork, previewUrl: t.previewUrl, description: t.description, semantic })),
    };
  }

  async findMine(userId: string) {
    const shelves = await this.prisma.shelf.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: this.include });
    return shelves.map((s) => this.toResponse(s));
  }

  async create(userId: string, dto: CreateShelfDto) {
    // 곡은 제목·가수로 하나만 둔다 — 이미 있으면 빠진 커버·미리듣기만 채운다
    const tracks = [];
    for (const t of dto.tracks) {
      const have = await this.prisma.track.findUnique({ where: { title_artist: { title: t.title, artist: t.artist } } });
      tracks.push(
        have
          ? await this.prisma.track.update({
              where: { id: have.id },
              data: { artwork: have.artwork ?? t.artwork, previewUrl: have.previewUrl ?? t.previewUrl },
            })
          : await this.prisma.track.create({ data: { title: t.title, artist: t.artist, artwork: t.artwork, previewUrl: t.previewUrl } }),
      );
    }
    const ids = [...new Set(tracks.map((t) => t.id))];
    const pct = new Map(tracks.map((t, i) => [t.id, dto.tracks[i].semantic ?? null]));
    const query = dto.query ?? '';
    // 같은 요청문·같은 곡 묶음을 또 넣으면 새 서랍 대신 그 서랍(이름만 새것으로) — 10/2 같은 "미쳤어" 서랍이 두 개 생겼다
    const same = await this.prisma.shelf.findMany({ where: { userId, query }, select: { id: true, tracks: { select: { trackId: true } } } });
    const dup = same.find((s) => s.tracks.length === ids.length && s.tracks.every((x) => ids.includes(x.trackId)));
    const shelf = dup
      ? await this.prisma.shelf.update({ where: { id: dup.id }, data: { tag: dto.tag }, include: this.include })
      : await this.prisma.shelf.create({
          data: { userId, tag: dto.tag, query, keywords: JSON.stringify(dto.keywords ?? []), tracks: { create: ids.map((trackId, order) => ({ trackId, order, semantic: pct.get(trackId) ?? null })) } },
          include: this.include,
        });
    return this.toResponse(shelf);
  }

  /** 유튜브 재생목록 링크 — 모르는 곡만 영상을 찾고(한 번 찾으면 영구), 찾은 곡들로 watch_videos 링크(로그인·할당량 0).
      못 찾았거나 오늘 상한에 걸린 곡은 곡별 유튜브 검색 링크로 */
  async playlist(userId: string, id: string) {
    const shelf = await this.prisma.shelf.findFirst({ where: { id, userId }, include: this.include });
    if (!shelf) throw new NotFoundException('그런 서랍은 없네');
    const { tracks, exhausted } = await this.videos.ensure(shelf.tracks.map((s) => s.track));
    const ids = tracks.flatMap((t) => (t.videoId ? [t.videoId] : []));
    return {
      url: ids.length ? watchUrl(ids.slice(0, 50)) : null, // watch_videos 는 50개까지
      found: ids.length,
      total: tracks.length,
      exhausted, // 오늘 검색 상한에 걸려 못 물어본 곡이 있다
      missing: tracks.filter((t) => !t.videoId).map((t) => ({ title: t.title, artist: t.artist, search: searchUrl(t) })),
    };
  }

  /** 공개 서랍 — 공유 링크(/s/:id)로 누구나 본다. 요청문·네임택·곡까지만(누가 만들었는지는 안 보낸다, 10/1 사용자: 요청문은 공개).
      유튜브는 이미 찾아 둔 영상만으로 링크 — 여기서 새로 찾으면 아무나 검색 상한을 써 버린다 */
  async findPublic(id: string) {
    const shelf = await this.prisma.shelf.findUnique({ where: { id }, include: this.include });
    if (!shelf) throw new NotFoundException('그런 서랍은 없네');
    const ids = shelf.tracks.flatMap(({ track }) => (track.videoId ? [track.videoId] : []));
    return {
      ...this.toResponse(shelf),
      youtube: ids.length ? watchUrl(ids.slice(0, 50)) : null,
      missing: shelf.tracks.filter(({ track }) => !track.videoId).map(({ track }) => ({ title: track.title, artist: track.artist, search: searchUrl(track) })),
    };
  }

  async remove(userId: string, id: string) {
    const shelf = await this.prisma.shelf.findFirst({ where: { id, userId } });
    if (!shelf) throw new NotFoundException('그런 서랍은 없네');
    await this.prisma.shelf.delete({ where: { id } });
    return { id };
  }
}

@ApiTags('shelves')
@Controller('shelves')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ShelvesController {
  constructor(private readonly shelves: ShelvesService) {}

  @Get()
  @ApiOperation({ summary: '내 서랍 목록 — 최근 것부터' })
  findMine(@Req() req: Req) {
    return this.shelves.findMine(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: '서랍에 넣기 — 네임택·요청문·곡 순서' })
  create(@Req() req: Req, @Body() dto: CreateShelfDto) {
    return this.shelves.create(req.user.id, dto);
  }

  @Post(':id/playlist')
  @ApiOperation({ summary: '유튜브에서 이어 듣기 — watch_videos 링크 + 못 찾은 곡의 검색 링크' })
  playlist(@Req() req: Req, @Param('id') id: string) {
    return this.shelves.playlist(req.user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '서랍 비우기' })
  remove(@Req() req: Req, @Param('id') id: string) {
    return this.shelves.remove(req.user.id, id);
  }
}

/* 로그인 없이 — 공유 링크로 들어온 사람이 보는 서랍 */
@ApiTags('shelves')
@Controller('shelves/public')
export class PublicShelvesController {
  constructor(private readonly shelves: ShelvesService) {}

  @Get(':id')
  @ApiOperation({ summary: '공개 서랍 — 공유 링크로 보는 요청문·네임택·곡(로그인 없이). 유튜브는 이미 찾아 둔 영상만' })
  findPublic(@Param('id') id: string) {
    return this.shelves.findPublic(id);
  }
}

@Module({ imports: [CatalogModule], controllers: [PublicShelvesController, ShelvesController], providers: [ShelvesService] })
export class ShelvesModule {}
