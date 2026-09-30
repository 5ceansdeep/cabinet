import { Controller, Get, Injectable, Module, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Interpreter } from './interpret.js';
import { Reranker } from './rerank.js';
import { display, rank } from './score.js';

/* 요청문 → 풀어 쓴 설명의 벡터 + 목표 에너지·밝기(Interpreter) → 곡마다 뜻(코사인)·소리(거리) 점수로 후보 20곡(1단계)
   → Gemini 가 곡 설명을 읽고 다시 골라 상위 몇 곡 + 곡마다 이유 + 신의 한마디(Reranker, 2단계).
   곡 설명·벡터는 배치(catalog/describe.ts)가 미리 만들어 둔다 — 설명이 없는 곡은 아직 후보가 아니다.
   검색은 결과 상위 가수만 SearchLog 에 남긴다 — 곡 풀 넓히기(catalog/pool.ts)가 씨앗으로 쓴다. 요청문 원문은 안 남긴다.
   ponytail: 요청마다 곡 벡터 JSON 을 전부 읽어 푼다 — 곡이 수천 개를 넘으면 메모리에 두거나 Neon pgvector 로 */

export const CANDIDATES = 20; // 1단계가 넘기는 후보 수 — 여기서 버린 곡은 2단계가 못 살린다. 늘리면 Gemini 입력이 길어진다
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
    private readonly reranker: Reranker,
  ) {}

  /** 설명·벡터가 있는 곡 전부 — 평가(eval.ts)도 쓴다 */
  async loadPool() {
    const rows = await this.prisma.track.findMany({ where: { embedding: { not: null } }, select: SELECT });
    return rows.map((t) => ({ ...t, vector: JSON.parse(t.embedding!) as number[] }));
  }

  async recommend(query: string, opts: { seen?: string[]; thrown?: string[]; limit?: number } = {}) {
    const { seen = [], thrown = [], limit = 6 } = opts;
    const asked = await this.interpreter.interpret(query);
    const ranked = rank(await this.loadPool(), asked, { seen, thrown });
    // 2단계 — 1단계가 거른 후보를 Gemini 가 읽고 다시 고른다(+ 곡마다 이유, 신의 한마디)
    const cands = ranked.slice(0, CANDIDATES);
    const { order, reasons, line } = await this.reranker.rerank(query, asked.description, cands);
    const picked = order.slice(0, limit).map((id) => cands.find((t) => t.id === id)!);
    // 화면 일치도는 1단계 점수로 늘린 값 — 재정렬로 순서가 바뀌면 2등이 1등보다 높아 보이니, 뽑힌 곡들의 % 를 큰 것부터 새 순서대로 나눠 준다
    const pct = picked.map((t) => shown(t, ranked).semantic).sort((a, b) => b - a);
    const tracks = picked.map((t, i) => ({ ...shown(t, ranked), semantic: pct[i], reason: reasons[t.id] ?? null }));

    // 처음 뒤질 때만 남긴다("다시 찾기"·"몇 곡 더"는 같은 요청) — 실패해도 결과는 준다
    if (!seen.length && !thrown.length && query.trim()) {
      void this.prisma.searchLog
        .create({ data: { tags: '{}', artists: JSON.stringify([...new Set(tracks.map((t) => t.artist))].slice(0, 3)) } })
        .catch(() => undefined);
    }
    return { interpretation: asked.keywords, description: asked.description, line, tracks };
  }

  /** 곡 하나를 요청문에 대 본다 — 보고서. 일치도는 곡 풀 전체 안에서 늘린 값이라 전체 순위를 낸다 */
  async one(id: string, query: string) {
    const asked = await this.interpreter.interpret(query);
    const ranked = rank(await this.loadPool(), asked);
    const t = ranked.find((x) => x.id === id);
    if (!t) throw new NotFoundException('그런 곡은 서랍에 없네');
    return { interpretation: asked.keywords, description: asked.description, track: shown(t, ranked) };
  }
}

type Ranked = Row & { score: number };

function shown(t: Ranked, ranked: Ranked[]) {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    artwork: t.artwork,
    previewUrl: t.previewUrl,
    videoId: t.videoId,
    semantic: display(t.score, Math.min(...ranked.map((x) => x.score)), ranked[0].score),
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

@Module({ imports: [CatalogModule], controllers: [RecommendController], providers: [RecommendService, Interpreter, Reranker] })
export class RecommendModule {}
