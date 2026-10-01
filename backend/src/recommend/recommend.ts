import { Body, Controller, Get, HttpCode, Injectable, Ip, Module, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { CatalogModule } from '../catalog/catalog.module.js';
import { GENRES, inGenres } from '../catalog/genres.js';
import { same } from '../catalog/itunes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VoiceModule, VoiceService } from '../voice/voice.js';
import { Interpreter } from './interpret.js';
import { Reranker } from './rerank.js';
import { display, rank, throwPenalty } from './score.js';

class ThrowDto {
  @ApiProperty({ description: '던진 곡 id' })
  @IsString()
  @MaxLength(40)
  id!: string;
}

/* 요청문 → 풀어 쓴 설명의 벡터 + 목표 에너지·밝기(Interpreter) → 곡마다 뜻(코사인)·소리(거리) 점수로 상위 몇 곡(1단계) — 바로 돌려준다.
   신의 한마디와 곡마다 이유는 따로(GET /recommend/line) — 화면은 디스크를 먼저 띄우고 한마디는 뒤이어 붙인다(9/30, 3~4초 줄임).
   Gemini 재정렬 순서는 안 쓴다 — 평가에서 1단계만 쓸 때가 나았다(65% vs 56%). eval.ts 의 rerank 옵션으로는 계속 잴 수 있다.
   곡 설명·벡터는 배치(catalog/describe.ts)가 미리 만들어 둔다 — 설명이 없는 곡은 아직 후보가 아니다.
   검색은 해석 태그(Last.fm 영어)와 결과 상위 가수만 SearchLog 에, 던진 곡은 ThrowLog 에 남긴다 — 곡 풀 넓히기(catalog/pool.ts)가 씨앗으로 쓴다. 요청문 원문은 안 남긴다.
   ponytail: 요청마다 곡 벡터 JSON 을 전부 읽어 푼다 — 곡이 수천 개를 넘으면 메모리에 두거나 Neon pgvector 로 */

export const CANDIDATES = 20; // 재정렬 평가(eval.ts rerank)에서 1단계가 넘기는 후보 수 — 화면은 재정렬 순서를 안 쓴다
const Q_MAX = 300; // 요청문 글자 — 길수록 Gemini 한도·비용을 먹는다
const ids = (s?: string) => (s ? s.split(',').filter(Boolean) : []);
const POOL_CHECK_MS = 60_000; // 곡 목록을 메모리에 두고, 이만큼 지나면 DB 가 바뀌었나 가볍게 확인(곡 수·마지막 분석 시각)
const LINE_MAX = 10; // 한마디에 넘기는 곡 수 상한
const MIN_GENRE = 6; // 고른 장르 곡이 이보다 적으면 나머지 곡으로 채운다 — 빈 서랍보다 낫다(장르 곡이 앞)
const THROW_DAYS = 30; // 이만큼 지난 던진 기록은 순위에 안 쓴다 — 곡 설명을 고치면 다시 기회를
const THROW_PER_IP = 100; // 한 곳에서 하루에 세는 던진 곡 수

type Row = {
  id: string;
  title: string;
  artist: string;
  artwork: string | null;
  previewUrl: string | null;
  videoId: string | null;
  description: string | null;
  embedding: string | null;
  tags: string;
  energy: number | null;
  valence: number | null;
};
const SELECT = { id: true, title: true, artist: true, artwork: true, previewUrl: true, videoId: true, description: true, embedding: true, tags: true, energy: true, valence: true };

@Injectable()
export class RecommendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly interpreter: Interpreter,
    private readonly reranker: Reranker,
    private readonly voice: VoiceService,
  ) {}

  /* 곡 목록 — 임베딩이 곡당 768개 숫자라 244곡이 3.5MB, 싱가포르에서 받는 데 2초였다(9/30). 메모리에 두고,
     POOL_CHECK_MS 가 지나면 곡 수·마지막 설명·소리 분석 시각만 물어 달라졌을 때만 다시 읽는다 — 재시작 필요 없음.
     ponytail: 서버가 여러 대면 각자 들고 있다(최대 1분 어긋남) */
  private pool?: { sig: string; rows: Promise<Pooled[]>; checked: number };

  private async signature() {
    const a = await this.prisma.track.aggregate({ _count: true, _max: { describedAt: true, soundAt: true, checkedAt: true } });
    return [a._count, a._max.describedAt?.getTime(), a._max.soundAt?.getTime(), a._max.checkedAt?.getTime()].join('|');
  }

  /** 설명·벡터가 있는 곡 전부 — 평가(eval.ts)도 쓴다 */
  async loadPool(): Promise<Pooled[]> {
    const now = Date.now();
    if (this.pool && now - this.pool.checked < POOL_CHECK_MS) return this.pool.rows;
    const sig = await this.signature();
    if (this.pool?.sig === sig) {
      this.pool.checked = now;
      return this.pool.rows;
    }
    const rows = this.prisma.track
      .findMany({ where: { embedding: { not: null } }, select: SELECT })
      .then((rs) => rs.map((t) => ({ ...t, vector: JSON.parse(t.embedding!) as number[] })));
    this.pool = { sig, rows, checked: now };
    rows.catch(() => (this.pool = undefined)); // 실패면 다음 요청이 다시
    return rows;
  }

  async recommend(query: string, opts: { seen?: string[]; thrown?: string[]; genres?: string[]; limit?: number } = {}) {
    const { seen = [], thrown = [], genres = [], limit = 6 } = opts;
    const [asked, pool, penalty] = await Promise.all([this.interpreter.interpret(query), this.loadPool(), this.penalties()]); // 서로 필요 없다 — 같이
    const all = rank(pool, asked, { seen, thrown, penalty });
    // 요청문에서 직접 말한 가수 곡이 맨 앞(점수 순 — "신나는" 은 소리 점수가 가른다), 말한 장르는 편지지 칩과 같이 거른다
    const named = asked.artists?.length ? all.filter((t) => asked.artists!.some((a) => same(t.artist, a))) : [];
    const want = [...new Set([...genres, ...(asked.genres ?? [])])];
    const rest = all.filter((t) => !named.includes(t));
    const inGenre = rest.filter((t) => inGenres(JSON.parse(t.tags) as Record<string, number>, want));
    const ranked = [...named, ...(named.length + inGenre.length >= MIN_GENRE || !want.length ? inGenre : [...inGenre, ...rest.filter((t) => !inGenre.includes(t))])];
    const tracks = ranked.slice(0, limit).map((t) => shown(t, ranked));

    // 처음 뒤질 때만 남긴다("다시 찾기"·"몇 곡 더"는 같은 요청) — 실패해도 결과는 준다
    if (!seen.length && !thrown.length && query.trim()) {
      void this.prisma.searchLog
        .create({ data: { tags: JSON.stringify(Object.fromEntries((asked.tags ?? []).map((t) => [t, 100]))), artists: JSON.stringify([...new Set(tracks.map((t) => t.artist))].slice(0, 3)) } })
        .catch(() => undefined);
    }
    return { interpretation: asked.keywords, description: asked.description, tracks };
  }

  /** 최근 THROW_DAYS 일 동안 던져진 곡 → 깎을 점수 */
  private async penalties() {
    const since = new Date(Date.now() - THROW_DAYS * 86_400_000);
    const rows = await this.prisma.throwLog.groupBy({ by: ['trackId'], where: { createdAt: { gte: since } }, _count: true });
    return new Map(rows.map((r) => [r.trackId, throwPenalty(r._count)]));
  }

  /* 던진 곡 기록 — 화면에서 디스크를 던질 때마다. 로그인 없이 부르니, 한 곳(IP)에서 같은 곡은 한 번만, 하루 THROW_PER_IP 곡까지 센다
     (한 사람이 같은 곡을 계속 던져 순위를 끌어내리지 못하게). 모르는 곡 id(가짜 곡)는 조용히 버린다.
     ponytail: 세는 건 메모리 — 서버를 끄면 비고, 여러 대면 따로 센다 */
  private readonly throwsBy = new Map<string, { ids: Set<string>; until: number }>();

  async logThrow(id: string, ip: string) {
    const now = Date.now();
    if (this.throwsBy.size > 10_000) for (const [k, b] of this.throwsBy) if (b.until < now) this.throwsBy.delete(k);
    let b = this.throwsBy.get(ip);
    if (!b || b.until < now) this.throwsBy.set(ip, (b = { ids: new Set(), until: now + 86_400_000 }));
    if (b.ids.has(id) || b.ids.size >= THROW_PER_IP) return;
    b.ids.add(id);
    await this.prisma.throwLog.create({ data: { trackId: id } }).catch(() => undefined);
  }

  /** 보여 준 곡들을 건네며 하는 신의 한마디 + 곡마다 이유 — 디스크가 뜬 뒤 따로 부른다. 요청 풀어쓰기는 캐시에 있다 */
  async line(query: string, ids: string[]) {
    const [asked, pool] = await Promise.all([this.interpreter.interpret(query), this.loadPool()]);
    const cands = ids.map((id) => pool.find((t) => t.id === id)).filter((t) => !!t);
    if (!cands.length) return { line: null, reasons: {} };
    const { reasons, line } = await this.reranker.rerank(query, asked.description, cands);
    // 영어 음성 id — ELEVENLABS_ENABLED 가 꺼져 있으면 null(프론트는 기계 음성)
    return { line: line && { ...line, voice: this.voice.register(line.en) }, reasons };
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

type Pooled = Row & { vector: number[] };
type Ranked = Row & { score: number };

function shown(t: Ranked, ranked: Ranked[]) {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    artwork: t.artwork,
    previewUrl: t.previewUrl,
    videoId: t.videoId,
    semantic: display(t.score, Math.min(...ranked.map((x) => x.score)), Math.max(...ranked.map((x) => x.score))), // 말한 가수 곡이 앞이면 맨 앞이 최고점이 아니다
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
  @ApiQuery({ name: 'g', required: false, description: `장르 키(쉼표) — ${Object.keys(GENRES).join(', ')}. 모르는 키는 버린다` })
  get(@Query('q') q = '', @Query('seen') seen?: string, @Query('thrown') thrown?: string, @Query('g') g?: string) {
    const genres = ids(g).filter((k) => k in GENRES);
    return this.svc.recommend(q.slice(0, Q_MAX), { seen: ids(seen), thrown: ids(thrown), genres });
  }

  @Get('line')
  @ApiOperation({ summary: '보여 준 곡들을 건네는 신의 한마디(자막·영어 음성 id) + 곡마다 이유 — 곡 목록 뒤에 따로 부른다' })
  @ApiQuery({ name: 'q', example: '새벽에 혼자 걷는 기분' })
  @ApiQuery({ name: 'ids', description: `보여 준 곡 id(쉼표, 최대 ${LINE_MAX}개)` })
  line(@Query('q') q = '', @Query('ids') list?: string) {
    return this.svc.line(q.slice(0, Q_MAX), ids(list).slice(0, LINE_MAX));
  }

  @Post('throw')
  @HttpCode(204)
  @ApiOperation({ summary: '디스크를 던졌다 — 자주 던져지는 곡은 순위가 조금 내려간다. 같은 곳에서 같은 곡은 하루 한 번만 센다' })
  throw(@Body() dto: ThrowDto, @Ip() ip: string) {
    return this.svc.logThrow(dto.id, ip);
  }

  @Get(':id')
  @ApiOperation({ summary: '곡 하나를 요청문에 대 보기 — 보고서' })
  one(@Param('id') id: string, @Query('q') q = '') {
    return this.svc.one(id, q.slice(0, Q_MAX));
  }
}

@Module({ imports: [CatalogModule, VoiceModule], controllers: [RecommendController], providers: [RecommendService, Interpreter, Reranker] })
export class RecommendModule {}
