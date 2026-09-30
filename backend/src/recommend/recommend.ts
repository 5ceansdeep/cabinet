import { Controller, Get, Injectable, Module, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type Asked, Interpreter } from './interpret.js';
import { away, dot, soundScore, total } from './score.js';

/* 요청문 → 풀어 쓴 설명의 벡터 + 목표 에너지·밝기(Interpreter) → 곡마다 뜻(코사인)·소리(거리) 점수 → 상위 몇 곡.
   곡 설명·벡터는 배치(catalog/describe.ts)가 미리 만들어 둔다 — 설명이 없는 곡은 아직 후보가 아니다.
   검색은 결과 상위 가수만 SearchLog 에 남긴다 — 곡 풀 넓히기(catalog/pool.ts)가 씨앗으로 쓴다. 요청문 원문은 안 남긴다.
   ponytail: 요청마다 곡 벡터 JSON 을 전부 읽어 푼다 — 곡이 수천 개를 넘으면 메모리에 두거나 Neon pgvector 로 */

const Q_MAX = 300; // 요청문 글자 — 길수록 Gemini 한도·비용을 먹는다
const ids = (s?: string) => (s ? s.split(',').filter(Boolean) : []);

type Row = {
  id: string;
  title: string;
  artist: string;
  artwork: string | null;
  previewUrl: string | null;
  videoId: string | null;
  description: string | null;
  embedding: string | null;
  energy: number | null;
  valence: number | null;
};
const SELECT = { id: true, title: true, artist: true, artwork: true, previewUrl: true, videoId: true, description: true, embedding: true, energy: true, valence: true };

@Injectable()
export class RecommendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly interpreter: Interpreter,
  ) {}

  async recommend(query: string, opts: { seen?: string[]; thrown?: string[]; limit?: number } = {}) {
    const { seen = [], thrown = [], limit = 6 } = opts;
    const pool = (await this.prisma.track.findMany({ where: { embedding: { not: null } }, select: SELECT })).map((t) => ({
      ...t,
      vector: JSON.parse(t.embedding!) as number[],
    }));

    const asked = await this.interpreter.interpret(query);
    // 던진 곡이 있으면 그 곡들 쪽에서 멀어지게 요청을 민다
    const byId = new Map(pool.map((t) => [t.id, t.vector]));
    const want = away(asked.vector, thrown.map((id) => byId.get(id)).filter((v) => !!v));
    const skip = new Set([...seen, ...thrown]);

    const ranked = pool
      .filter((t) => !skip.has(t.id))
      .map((t) => scored(t, t.vector, asked, want))
      .sort((a, b) => b.semantic - a.semantic);
    // 가수당 한 곡씩 먼저 — 한 가수로 몰리지 않게. 모자라면 나머지로 채운다
    const artists = new Set<string>();
    const first = ranked.filter((t) => !artists.has(t.artist) && artists.add(t.artist));
    const tracks = [...first, ...ranked.filter((t) => !first.includes(t))].slice(0, limit);

    // 처음 뒤질 때만 남긴다("다시 찾기"·"몇 곡 더"는 같은 요청) — 실패해도 결과는 준다
    if (!seen.length && !thrown.length && query.trim()) {
      void this.prisma.searchLog
        .create({ data: { tags: '{}', artists: JSON.stringify([...new Set(tracks.map((t) => t.artist))].slice(0, 3)) } })
        .catch(() => undefined);
    }
    return { interpretation: asked.keywords, description: asked.description, tracks };
  }

  /** 곡 하나를 요청문에 대 본다 — 보고서 */
  async one(id: string, query: string) {
    const t = await this.prisma.track.findUnique({ where: { id }, select: SELECT });
    if (!t?.embedding) throw new NotFoundException('그런 곡은 서랍에 없네');
    const asked = await this.interpreter.interpret(query);
    return { interpretation: asked.keywords, description: asked.description, track: scored(t, JSON.parse(t.embedding) as number[], asked, asked.vector) };
  }
}

function scored(t: Row, vector: number[], asked: Asked, want: number[]) {
  const meaning = Math.max(0, dot(want, vector));
  const sound = soundScore(t, asked);
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    artwork: t.artwork,
    previewUrl: t.previewUrl,
    videoId: t.videoId,
    semantic: Math.round(total(meaning, sound) * 100),
    description: t.description, // 곡 설명 — 보고서에서 요청 설명과 나란히 "왜 이 곡인지"
  };
}

@ApiTags('recommend')
@Controller('recommend')
export class RecommendController {
  constructor(private readonly svc: RecommendService) {}

  @Get()
  @ApiOperation({ summary: '요청문으로 곡 꺼내기 — 요청 해석(짧은 말·풀어 쓴 설명) + 곡별 일치 점수' })
  @ApiQuery({ name: 'q', example: '새벽에 혼자 걷는 기분' })
  @ApiQuery({ name: 'seen', required: false, description: '이미 보여 준 곡 id(쉼표) — "몇 곡 더"' })
  @ApiQuery({ name: 'thrown', required: false, description: '던져 버린 곡 id(쉼표) — 빼고, 그 곡들 쪽에서 멀어진다' })
  get(@Query('q') q = '', @Query('seen') seen?: string, @Query('thrown') thrown?: string) {
    return this.svc.recommend(q.slice(0, Q_MAX), { seen: ids(seen), thrown: ids(thrown) });
  }

  @Get(':id')
  @ApiOperation({ summary: '곡 하나를 요청문에 대 보기 — 보고서' })
  one(@Param('id') id: string, @Query('q') q = '') {
    return this.svc.one(id, q.slice(0, Q_MAX));
  }
}

@Module({ imports: [CatalogModule], controllers: [RecommendController], providers: [RecommendService, Interpreter] })
export class RecommendModule {}
