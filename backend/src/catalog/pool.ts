import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { genreTags } from './genres.js';
import { findOnITunes } from './itunes.js';
import { artistTopTracks, fetchTags, similarArtists, similarTracks, tagTopTracks, type Ref, type Tags } from './lastfm.js';

/* 곡 풀 넓히기 — 관리자 배치(POST /catalog/grow)와 매일 새벽 자동 실행. 사용자 요청 중엔 외부 API 를 부르지 않는다.
   씨앗: 최근 검색 기록(SearchLog)의 결과 가수 + 장르를 섞은 태그 + 애플 뮤직 한국·미국 차트.
   후보: 태그 인기곡(Last.fm), 비슷한 가수의 인기곡(Last.fm), 차트 곡.
   걸러내기: 커버·미리듣기가 있는 곡만(9/30 부터 한국 곡만 거르지 않는다 — 사용자 결정),
   같은 곡 다른 표기(JANNABI / 잔나비)는 미리듣기 주소로. 태그가 없으면 iTunes 장르(genres.ts).
   ponytail: 대기열은 메모리 — 서버를 끄면 남은 줄은 사라진다(다음 배치가 다시 채운다) */

export const GAP_MS = 3100; // iTunes 는 분당 20회 남짓 — iTunes 를 부른 곡마다 쉰다
const DEFAULT_ADD = 30; // 한 번에 새로 담을 곡 수
const AUTO_TARGET = 10; // missingArtist·missingSong 자동 넓히기 — 한 번에 이만큼만(10/7 사용자: 비용을 작게)
const NIGHT_HOUR = 4; // 매일 새벽 4시(서버 시간)
// 장르를 섞어 둔다 — 한 장르로 몰리지 않게. 추천 점수엔 장르를 쓰지 않고, 곡을 찾는 데만 쓴다
const SEED_TAGS = ['k-indie', 'korean ballad', 'indie', 'dream pop', 'house', 'r&b', 'rock', 'jazz', 'city pop'];
/* 태그 인기곡은 날마다 다음 쪽을 본다(쪽당 20곡, TAG_PAGES 일이면 태그당 200위까지 보고 처음으로).
   10/6: 늘 1쪽(상위 20곡)만 봐서 후보가 430곡 남짓에서 안 늘었고, 사나흘이면 다 본 곡뿐이었다(32 → 86 → 124 → 144곡을 뒤져야 30곡).
   ponytail: 쪽 번호를 날짜로 정한다(저장할 게 없다) — 하루에 여러 번 돌려도 같은 쪽. 200위로 모자라면 TAG_PAGES 를 늘린다 */
const TAG_PAGES = 10;
export const tagPage = (now = new Date()) => (Math.floor(now.getTime() / 86_400_000) % TAG_PAGES) + 1;
const CHARTS =['kr', 'us'].map((c) => `https://rss.marketingtools.apple.com/api/v2/${c}/music/most-played/50/songs.json`);

const keyOf = (r: Ref) => `${r.artist}\u0000${r.title}`.toLowerCase();
// 노래가 아닌 판만 거른다 — 목소리가 빠져 미리듣기로 곡을 알 수 없다. 단어별로 골라 둔다:
// 거름 = 반주(inst·instrumental·MR·karaoke·반주). 살림 = remix·live·sped up — 분위기가 다른 곡일 수 있다.
// 괄호나 " - " 뒤에 붙은 것만 본다 ("Mr. Chu" 같은 제목은 살린다)
const NOT_A_SONG = ['inst\\.?', 'instrumental', 'mr', 'karaoke'];
export const ALT_VERSION = new RegExp(`[([]\\s*[^)\\]]*\\b(${NOT_A_SONG.join('|')})\\b|\\s-\\s.*\\b(${NOT_A_SONG.join('|')})\\b|반주`, 'i');

/* 출처별 목록에서 한 곡씩 번갈아 — 한 목록(비슷한 가수 하나)이 앞을 다 차지하지 않게 */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

async function chart(url: string): Promise<Ref[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { feed?: { results?: { name: string; artistName: string }[] } };
    return (json.feed?.results ?? []).map((r) => ({ title: r.name, artist: r.artistName }));
  } catch {
    return [];
  }
}

export type GrowStatus = { running: boolean; target: number; added: number; tried: number; queued: number; startedAt: string | null; last: string[] };

@Injectable()
export class PoolService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Pool');
  private readonly seen = new Set<string>(); // 이번 서버 실행 동안 한 번 본 후보는 다시 안 본다
  private status: GrowStatus = { running: false, target: 0, added: 0, tried: 0, queued: 0, startedAt: null, last: [] };
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return this.status;
  }

  /** 배치 시작 — 이미 돌고 있으면 그 상태를 돌려준다. 끝날 때까지 기다리지 않는다 */
  start(target = DEFAULT_ADD, tags?: string[]) {
    if (this.status.running) return this.status;
    // 후보 모으기(몇 초)보다 먼저 진행 중으로 — 연달아 눌러도 두 번 돌지 않게
    this.status = { running: true, target, added: 0, tried: 0, queued: 0, startedAt: new Date().toISOString(), last: [] };
    void this.run(target, tags).catch((e) => {
      this.status.running = false;
      this.log.warn(`곡 풀 넓히기 실패: ${e}`);
    });
    return this.status;
  }

  private async seeds() {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const logs = await this.prisma.searchLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 200 });
    // 최근 검색에서 많이 나온 해석 태그·가수
    const tagScore = new Map<string, number>();
    const artistCount = new Map<string, number>();
    const askedCount = new Map<string, number>(); // 편지에 직접 쓴 가수 — 그 가수 인기곡을 먼저(10/2)
    for (const l of logs) {
      for (const a of JSON.parse(l.asked) as string[]) askedCount.set(a, (askedCount.get(a) ?? 0) + 1);
      for (const [t, w] of Object.entries(JSON.parse(l.tags) as Tags)) tagScore.set(t, (tagScore.get(t) ?? 0) + w);
      for (const a of JSON.parse(l.artists) as string[]) artistCount.set(a, (artistCount.get(a) ?? 0) + 1);
    }
    // 던져진 곡의 가수는 그만큼 덜 센다 — 보여 줬다고 다 마음에 든 건 아니다
    const thrown = await this.prisma.throwLog.findMany({ where: { createdAt: { gte: since } }, select: { track: { select: { artist: true } } } });
    for (const { track } of thrown) artistCount.set(track.artist, (artistCount.get(track.artist) ?? 0) - 1);
    const top = <K>(m: Map<K, number>, n: number) => [...m].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
    let artists = top(artistCount, 4);
    // 검색 기록이 없으면 곡 풀에서 아무 가수나
    if (!artists.length) {
      const some = await this.prisma.track.findMany({ where: { tags: { not: '{}' } }, select: { artist: true }, take: 50 });
      artists = [...new Set(some.map((t) => t.artist))].sort(() => Math.random() - 0.5).slice(0, 4);
    }
    return { tags: [...new Set([...top(tagScore, 3), ...SEED_TAGS])], artists, asked: top(askedCount, 6) };
  }

  /** only = 이 태그의 인기곡만(장르 채우기) */
  private async candidates(only?: string[]): Promise<Ref[]> {
    const { tags, artists, asked } = only?.length ? { tags: only, artists: [], asked: [] } : await this.seeds();
    const similar = (await Promise.all(artists.map((a) => similarArtists(a, 4)))).flat();
    const lists = await Promise.all([
      ...asked.map((a) => artistTopTracks(a, 8)), // 사람들이 찾은 가수 본인 곡 — 한글·원래 표기가 같이 들어오니 Last.fm 이 아는 쪽이 걸린다
      ...similar.map((a) => artistTopTracks(a, 3)),
      ...(only?.length ? [] : CHARTS.map(chart)),
      ...tags.map((t) => (only?.length ? tagTopTracks(t, 40) : tagTopTracks(t, 20, tagPage()))), // 장르 채우기(only)는 그 태그 상위 40곡 그대로
    ]);
    // 여기선 seen 에 넣지 않는다 — 실제로 들여다본 곡만 run 이 넣는다. 10/6 새벽: 모은 후보를 전부 seen 에 넣었더니
    // 목표(30곡)를 채우고 남은 후보까지 "본 것"이 돼, 서버를 안 껐던 다음 날 밤 후보가 0곡이었다(배포한 날만 메모리가 비어 돌았다)
    const out = new Map<string, Ref>();
    for (const r of interleave(lists)) {
      const k = keyOf(r);
      if (!this.seen.has(k) && !out.has(k) && !ALT_VERSION.test(r.title)) out.set(k, r);
    }
    return [...out.values()];
  }

  private async run(target: number, only?: string[]) {
    const queue = await this.candidates(only);
    this.status.queued = queue.length;
    this.log.log(`곡 풀 넓히기 시작 — 후보 ${queue.length}곡, 목표 ${target}곡`);
    try {
      while (queue.length && this.status.added < target) {
        const r = queue.shift()!;
        this.seen.add(keyOf(r));
        this.status.tried++;
        this.status.queued = queue.length;
        const { calledITunes, added } = await this.add(r);
        if (added) {
          this.status.added++;
          this.status.last = [added, ...this.status.last].slice(0, 10);
        }
        if (calledITunes) await new Promise((ok) => setTimeout(ok, GAP_MS));
      }
    } finally {
      this.status.running = false;
      this.log.log(`곡 풀 넓히기 끝 — ${this.status.tried}곡 보고 ${this.status.added}곡 담음`);
    }
  }

  /** 곡 하나 — 담았으면 "가수 - 제목" + id(바로 설명을 붙일 때 쓴다) */
  private async add(r: Ref): Promise<{ calledITunes: boolean; added: string | null; id: string | null }> {
    if (await this.prisma.track.findFirst({ where: { title: r.title, artist: r.artist } })) return { calledITunes: false, added: null, id: null };
    let tags = await fetchTags(r.title, r.artist);
    const it = await findOnITunes(r.title, r.artist);
    if (!it?.previewUrl || !it.artwork) return { calledITunes: true, added: null, id: null };
    // iTunes 가 반주 판을 줄 때도 있다(Last.fm 제목은 멀쩡해도 "비밀번호 486 (Instrumental)") — 받은 제목도 거른다
    if (ALT_VERSION.test(it.title)) return { calledITunes: true, added: null, id: null };
    // 태그는 곡 설명을 쓸 때 참고로만 — 없어도 담는다
    if (!Object.keys(tags).length) tags = genreTags(it.genre);
    // 같은 곡이 다른 표기로(JANNABI / 잔나비) 이미 있으면 — 미리듣기 주소가 같다
    const dupe = await this.prisma.track.findFirst({ where: { previewUrl: it.previewUrl } });
    if (dupe) return { calledITunes: true, added: null, id: null };
    // iTunes 표기를 곡 이름으로 쓴다 — 이미 있으면 태그만 채운다
    const row = await this.prisma.track.upsert({
      where: { title_artist: { title: it.title, artist: it.artist } },
      create: { title: it.title, artist: it.artist, artistAlt: it.artistAlt, artwork: it.artwork, previewUrl: it.previewUrl, tags: JSON.stringify(tags) },
      update: { tags: JSON.stringify(tags) },
    });
    return { calledITunes: true, added: `${it.artist} - ${it.title}`, id: row.id };
  }

  /** 한 가수(또는 비슷한 가수) 곡만 몇 곡 — missingArtist 가 나왔을 때 백그라운드로(10/7 사용자).
      이미 밤 배치·관리자 넓히기가 돌고 있으면 iTunes 호출이 겹치지 않게 건너뛴다(다음에 다시 걸린다) */
  async growFor(artist: string, target = AUTO_TARGET): Promise<string[]> {
    if (this.status.running) return [];
    const similar = await similarArtists(artist, 4);
    const lists = await Promise.all([artistTopTracks(artist, 8), ...similar.map((a) => artistTopTracks(a, 3))]);
    return this.fill(interleave(lists), target);
  }

  /** 꼽은 곡 하나가 서류함에 없을 때 — 그 곡과 비슷한 곡 + 가수 본인 곡을 몇 곡(10/7 사용자) */
  async growForSong(artist: string, title: string, target = AUTO_TARGET): Promise<string[]> {
    if (this.status.running) return [];
    const [near, own] = await Promise.all([similarTracks(title, artist, 30), artistTopTracks(artist, 6)]);
    return this.fill(interleave([near, own]), target);
  }

  /** candidates(only) 와 같은 거르기·seen 체크로 target 곡까지 담고, 새로 담은 곡의 id 를 돌려준다 */
  private async fill(refs: Ref[], target: number): Promise<string[]> {
    const ids: string[] = [];
    for (const r of refs) {
      if (ids.length >= target) break;
      const k = keyOf(r);
      if (this.seen.has(k) || ALT_VERSION.test(r.title)) continue;
      this.seen.add(k);
      const { calledITunes, added, id } = await this.add(r);
      if (added && id) ids.push(id);
      if (calledITunes) await new Promise((ok) => setTimeout(ok, GAP_MS));
    }
    return ids;
  }

  // 매일 새벽 NIGHT_HOUR 시에 기본 목표만큼
  onModuleInit() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(NIGHT_HOUR, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    this.timer = setTimeout(() => {
      this.start();
      this.onModuleInit();
    }, next.getTime() - now.getTime());
  }

  onModuleDestroy() {
    clearTimeout(this.timer);
  }
}
