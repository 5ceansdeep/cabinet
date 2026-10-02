import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Injectable, Ip, Module, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { CatalogModule } from '../catalog/catalog.module.js';
import { GENRES, inGenres } from '../catalog/genres.js';
import { same } from '../catalog/itunes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VoiceModule, VoiceService } from '../voice/voice.js';
import { type Asked, Interpreter } from './interpret.js';
import { Reranker } from './rerank.js';
import { BONUS, type Candidate, display, lexical, rank, throwPenalty } from './score.js';

class ThrowDto {
  @ApiProperty({ description: '던진 곡 id' })
  @IsString()
  @MaxLength(40)
  id!: string;
}

/* 요청문 → 풀어 쓴 설명의 벡터 + 목표 에너지·밝기(Interpreter) → 곡마다 뜻(코사인)·소리(거리) 점수로 후보 20곡(1단계)
   → Gemini 가 후보의 곡 설명을 읽고 순서를 다시 매긴다 + 곡별 이유·신의 한마디(2단계, 같은 호출). 말한 가수 곡은 맨 앞에 고정.
   10/1: 곡 설명을 [핵심어]+묘사로 바꾼 뒤 재정렬이 기존 39개 재현율을 27% → 38% 로 올려 순서에도 쓴다(9/30 엔 1단계가 나았다 —
   그땐 곡 설명이 "가사 없는 연주곡" 투성이였다). 디스크가 1~2초 늦게 뜨는 대신 그 시간은 서랍 뒤지기 연출이 채운다.
   GET /recommend/line 은 예전 화면용으로 남겨 둔다.
   곡 설명·벡터는 배치(catalog/describe.ts)가 미리 만들어 둔다 — 설명이 없는 곡은 아직 후보가 아니다.
   검색은 해석 태그(Last.fm 영어)와 결과 상위 가수만 SearchLog 에, 던진 곡은 ThrowLog 에 남긴다 — 곡 풀 넓히기(catalog/pool.ts)가 씨앗으로 쓴다. 요청문 원문은 안 남긴다.
   ponytail: 요청마다 곡 벡터 JSON 을 전부 읽어 푼다 — 곡이 수천 개를 넘으면 메모리에 두거나 Neon pgvector 로 */

export const CANDIDATES = 20; // 1단계가 재정렬에 넘기는 후보 수 — 여기서 버린 곡은 2단계가 못 살린다. 늘리면 Gemini 입력이 길어진다
const RERANK_MS = 6000; // 재정렬이 이보다 늦으면 1단계 순서로 — 화면이 멈추면 안 된다
export const Q_MAX = 300; // 요청문 글자 — 길수록 Gemini 한도·비용을 먹는다
const ids = (s?: string) => (s ? s.split(',').filter(Boolean) : []);
const POOL_CHECK_MS = 60_000; // 곡 목록을 메모리에 두고, 이만큼 지나면 DB 가 바뀌었나 가볍게 확인(곡 수·마지막 분석 시각)
const LINE_MAX = 10; // 한마디에 넘기는 곡 수 상한
const PIN_TITLE = 3; // 제목 일치로 맨 앞에 고정하는 곡 수 — "비" 처럼 제목 여러 개에 걸리는 낱말이 다 차지하지 못하게
const SHOW = 10; // 한 번에 꺼내는 곡 수 — 6곡은 너무 적었다(10/1 사용자)
const MIN_GENRE = SHOW; // 고른 장르 곡이 이보다 적으면 나머지 곡으로 채운다 — 빈 서랍보다 낫다(장르 곡이 앞)
const THROW_DAYS = 30; // 이만큼 지난 던진 기록은 순위에 안 쓴다 — 곡 설명을 고치면 다시 기회를
const THROW_PER_IP = 100; // 한 곳에서 하루에 세는 던진 곡 수
const ASK_PER_MIN = 10; // 한 곳(IP)에서 Gemini 를 쓰는 요청(꺼내기·한마디·보고서 합쳐) — 분당. "다시 찾기"·"몇 곡 더"를 빨리 눌러도 넉넉
const ASK_PER_DAY = 200; // 하루 — 한 사람이 선불 크레딧을 바닥내지 못하게

/** 한 곳에서 최근 1분·하루 동안 부른 시각을 세어 넘으면 false. 같은 요청 다시(캐시라 돈 안 듦)도 센다.
    ponytail: 메모리 — 서버를 끄면 비고 여러 대면 따로 센다. 여러 IP 가 합쳐 쓰는 양은 AI Studio 비용 제한이 막는다 */
export class Limiter {
  private readonly hits = new Map<string, number[]>();
  constructor(
    private readonly perMin: number,
    private readonly perDay: number,
  ) {}

  hit(ip: string, now = Date.now()) {
    const day = now - 86_400_000;
    if (this.hits.size > 10_000) for (const [k, ts] of this.hits) if (ts[ts.length - 1] < day) this.hits.delete(k);
    const ts = (this.hits.get(ip) ?? []).filter((t) => t > day);
    this.hits.set(ip, ts);
    if (ts.length >= this.perDay || ts.filter((t) => t > now - 60_000).length >= this.perMin) return false;
    ts.push(now);
    return true;
  }
}

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
    const { seen = [], thrown = [], genres = [], limit = SHOW } = opts;
    const [asked, pool, penalty] = await Promise.all([this.interpreter.interpret(query), this.loadPool(), this.penalties()]); // 서로 필요 없다 — 같이
    const { ranked, cands, pick } = stage1(pool, asked, { seen, thrown, penalty, genres });
    // 2단계 — 후보 20곡의 곡 설명을 LLM 이 읽고 순서를 다시 매긴다(+ 곡별 이유·신의 한마디). 늦거나 실패하면 1단계 순서 그대로
    const rr = cands.length ? await within(this.reranker.rerank(query, readings(asked), cands), RERANK_MS) : null;
    const picked = pinTitled(pick(rr ? finalOrder(cands, rr.order, asked.artists) : ranked), asked).slice(0, limit);
    // 화면 일치도는 1단계 점수로 늘린 값 — 순서가 바뀌면 아래 곡이 더 높아 보이니, 뽑힌 곡들의 % 를 큰 것부터 새 순서대로 나눠 준다
    const pct = picked.map((t) => shown(t, ranked).semantic).sort((a, b) => b - a);
    const tracks = picked.map((t, i) => ({ ...shown(t, ranked), semantic: pct[i], reason: rr?.reasons[t.id] ?? null }));
    const line = rr?.line ? { ...rr.line, voice: this.voice.register(rr.line.en) } : null; // 영어 음성 id — ElevenLabs 를 꺼 두면 null

    // 처음 뒤질 때만 남긴다("다시 찾기"·"몇 곡 더"는 같은 요청) — 실패해도 결과는 준다
    if (!seen.length && !thrown.length && query.trim()) {
      void this.prisma.searchLog
        .create({ data: { tags: JSON.stringify(Object.fromEntries((asked.tags ?? []).map((t) => [t, 100]))), artists: JSON.stringify([...new Set(tracks.map((t) => t.artist))].slice(0, 3)) } })
        .catch(() => undefined);
    }
    return { interpretation: shownKeywords(asked), description: readings(asked), tracks, line };
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
    const { reasons, line } = await this.reranker.rerank(query, readings(asked), cands);
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

/** 점수 순위 뒤 손질 — 요청문에서 직접 말한 가수 곡이 맨 앞(점수 순 — "신나는" 은 소리 점수가 가른다),
    말한 장르는 편지지 칩과 같이 거른다(모자라면 나머지로 채움). 평가(eval.ts)도 같은 순서로 잰다 */
/** 1단계 — 점수 순위(+ 말한 가수·장르 손질)에서 재정렬 후보를 뽑는다. 서비스·평가(eval.ts)가 같이 쓴다.
    두 번째 읽기(alt)가 있으면 두 읽기의 순위에서 번갈아 후보를 뽑고, pick 이 최종 순서도 두 읽기로 번갈아 세운다 —
    "미쳤어" 처럼 애매한 요청에 10곡이 한쪽(지친 위로곡)으로 몰리지 않게. 사용자가 맞는 쪽만 남기고 던지면 된다 */
export function stage1<T extends Candidate & { tags: string }>(
  pool: T[],
  asked: Asked,
  opts: { seen?: string[]; thrown?: string[]; penalty?: Map<string, number>; genres?: string[]; a?: number; center?: boolean; bonus?: typeof BONUS } = {},
) {
  const { genres = [], ...rankOpts } = opts;
  const main = arrange(rank(pool, asked, rankOpts), asked, genres);
  if (!asked.alt) return { ranked: main, cands: main.slice(0, CANDIDATES), pick: <U extends { id: string }>(xs: U[]) => xs };
  const second = arrange(rank(pool, { ...asked.alt, words: asked.words }, rankOpts), asked, genres);
  const both = alternate(main, second);
  const at = (xs: T[], t: T) => (xs.includes(t) ? xs.indexOf(t) : Infinity);
  const side = new Map(both.map((t) => [t.id, at(main, t) <= at(second, t) ? 0 : 1] as const)); // 더 높이 둔 읽기 쪽
  const pick = <U extends { id: string }>(xs: U[]) => alternate(xs.filter((t) => side.get(t.id) !== 1), xs.filter((t) => side.get(t.id) === 1));
  return { ranked: both, cands: both.slice(0, CANDIDATES), pick };
}

/** 두 줄에서 번갈아 — 겹치는 곡은 한 번만 */
export function alternate<T extends { id: string }>(a: T[], b: T[]) {
  const out: T[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    for (const t of [a[i], b[i]])
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
  return out;
}

/** 재정렬·보고서에 넘기는 요청 설명 — 두 번째 읽기가 있으면 같이 */
export const readings = (asked: Asked) => (asked.alt ? `${asked.description}

또는
${asked.alt.description}` : asked.description);
/** 화면 "요청 해석" — 두 번째 읽기의 말도 두 개까지 */
const shownKeywords = (asked: Asked) => (asked.alt ? [...asked.keywords.slice(0, 3), ...asked.alt.keywords.slice(0, 2)] : asked.keywords);

/** 늦으면 null */
const within = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((ok) => setTimeout(() => ok(null), ms))]);

/** 마지막 손질 — 제목에 요청 낱말이 든 곡(PIN_TITLE 곡까지)은 맨 앞에 고정. 재정렬·두 읽기 번갈기가 분위기로 밀어내지 않게.
    10/2 "미쳤어" → Crazy 가 1단계 1위였는데 재정렬 5위, 번갈기 9위, 배포에선 10위 밖. 가수를 말했으면 그 곡들이 앞이라 손대지 않는다 */
export function pinTitled<T extends { id: string; title?: string }>(xs: T[], asked: Pick<Asked, 'words' | 'artists'>) {
  if (asked.artists?.length || !asked.words?.length) return xs;
  const hit = xs.filter((t) => lexical(t, asked.words, { title: 1, key: 0 }) > 0).slice(0, PIN_TITLE);
  return [...hit, ...xs.filter((t) => !hit.includes(t))];
}

/** 재정렬 순서로 — 말한 가수 곡은 맨 앞에 고정(재정렬이 섞지 않게). 평가(eval.ts)도 같은 순서로 잰다 */
export function finalOrder<T extends { id: string; artist: string }>(cands: T[], order: string[], artists: string[] = []) {
  const named = artists.length ? cands.filter((t) => artists.some((a) => same(t.artist, a))) : [];
  const byId = new Map(cands.map((t) => [t.id, t]));
  return [...named, ...order.map((id) => byId.get(id)).filter((t): t is T => !!t && !named.includes(t))];
}

export function arrange<T extends { artist: string; tags: string }>(all: T[], asked: Pick<Asked, 'artists' | 'genres'>, chips: string[] = []) {
  const named = asked.artists?.length ? all.filter((t) => asked.artists!.some((a) => same(t.artist, a))) : [];
  const want = [...new Set([...chips, ...(asked.genres ?? [])])];
  const rest = all.filter((t) => !named.includes(t));
  const inGenre = rest.filter((t) => inGenres(JSON.parse(t.tags) as Record<string, number>, want));
  return [...named, ...(named.length + inGenre.length >= MIN_GENRE || !want.length ? inGenre : [...inGenre, ...rest.filter((t) => !inGenre.includes(t))])];
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
  private readonly limiter = new Limiter(ASK_PER_MIN, ASK_PER_DAY);

  private guard(ip: string) {
    if (!this.limiter.hit(ip)) throw new HttpException('천천히 하게. 서랍은 그렇게 빨리 안 열리네', HttpStatus.TOO_MANY_REQUESTS);
  }

  @Get()
  @ApiOperation({ summary: '요청문으로 곡 꺼내기 — 요청 해석(짧은 말·풀어 쓴 설명) + 곡별 일치 점수 [Gemini]' })
  @ApiQuery({ name: 'q', example: '새벽에 혼자 걷는 기분' })
  @ApiQuery({ name: 'seen', required: false, description: '이미 보여 준 곡 id(쉼표) — "몇 곡 더"' })
  @ApiQuery({ name: 'thrown', required: false, description: '던져 버린 곡 id(쉼표) — 빼고, 그 곡들 쪽에서 멀어진다' })
  @ApiQuery({ name: 'g', required: false, description: `장르 키(쉼표) — ${Object.keys(GENRES).join(', ')}. 모르는 키는 버린다` })
  get(@Ip() ip: string, @Query('q') q = '', @Query('seen') seen?: string, @Query('thrown') thrown?: string, @Query('g') g?: string) {
    this.guard(ip);
    const genres = ids(g).filter((k) => k in GENRES);
    return this.svc.recommend(q.slice(0, Q_MAX), { seen: ids(seen), thrown: ids(thrown), genres });
  }

  @Get('line')
  @ApiOperation({ summary: '보여 준 곡들을 건네는 신의 한마디(자막·영어 음성 id) + 곡마다 이유 — 곡 목록 뒤에 따로 부른다 [Gemini]' })
  @ApiQuery({ name: 'q', example: '새벽에 혼자 걷는 기분' })
  @ApiQuery({ name: 'ids', description: `보여 준 곡 id(쉼표, 최대 ${LINE_MAX}개)` })
  line(@Ip() ip: string, @Query('q') q = '', @Query('ids') list?: string) {
    this.guard(ip);
    return this.svc.line(q.slice(0, Q_MAX), ids(list).slice(0, LINE_MAX));
  }

  @Post('throw')
  @HttpCode(204)
  @ApiOperation({ summary: '디스크를 던졌다 — 자주 던져지는 곡은 순위가 조금 내려간다. 같은 곳에서 같은 곡은 하루 한 번만 센다' })
  throw(@Body() dto: ThrowDto, @Ip() ip: string) {
    return this.svc.logThrow(dto.id, ip);
  }

  @Get(':id')
  @ApiOperation({ summary: '곡 하나를 요청문에 대 보기 — 보고서 [Gemini]' })
  one(@Ip() ip: string, @Param('id') id: string, @Query('q') q = '') {
    this.guard(ip);
    return this.svc.one(id, q.slice(0, Q_MAX));
  }
}

@Module({ imports: [CatalogModule, VoiceModule], controllers: [RecommendController], providers: [RecommendService, Interpreter, Reranker] })
export class RecommendModule {}
