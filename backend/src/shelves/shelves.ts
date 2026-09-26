import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';

/* 서랍 = 저장한 목록. 네임택과 그때의 요청문, 꽂힌 곡 순서를 남긴다 (DRIFT sectors 의 목록·저장·삭제 틀) */

class ShelfTrackDto {
  @ApiProperty({ example: 'Everything' }) @IsString() title!: string;
  @ApiProperty({ example: '검정치마' }) @IsString() artist!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() artwork?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() previewUrl?: string;
}

export class CreateShelfDto {
  @ApiProperty({ example: '#LATE-NIGHT' }) @IsString() @MinLength(1) @MaxLength(16) tag!: string;
  @ApiProperty({ example: '새벽에 혼자 걷는 기분', required: false }) @IsOptional() @IsString() @MaxLength(500) query?: string;
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
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = { tracks: { orderBy: { order: 'asc' as const }, include: { track: true } } };

  private toResponse(s: { id: string; tag: string; query: string; createdAt: Date; tracks: { track: { id: string; title: string; artist: string; artwork: string | null; previewUrl: string | null } }[] }) {
    return {
      id: s.id,
      tag: s.tag,
      query: s.query,
      createdAt: s.createdAt.toISOString(),
      tracks: s.tracks.map(({ track: t }) => ({ id: t.id, title: t.title, artist: t.artist, artwork: t.artwork, previewUrl: t.previewUrl })),
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
    const shelf = await this.prisma.shelf.create({
      data: {
        userId,
        tag: dto.tag,
        query: dto.query ?? '',
        tracks: { create: [...new Map(tracks.map((t) => [t.id, t])).values()].map((t, order) => ({ trackId: t.id, order })) },
      },
      include: this.include,
    });
    return this.toResponse(shelf);
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

  @Delete(':id')
  @ApiOperation({ summary: '서랍 비우기' })
  remove(@Req() req: Req, @Param('id') id: string) {
    return this.shelves.remove(req.user.id, id);
  }
}

@Module({ controllers: [ShelvesController], providers: [ShelvesService] })
export class ShelvesModule {}
