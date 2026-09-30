import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { genreTags } from './genres.js';
import { findOnITunes } from './itunes.js';
import { artistTopTracks, fetchTags, similarArtists, tagTopTracks, type Ref, type Tags } from './lastfm.js';

/* 곡 풀 넓히기 — 관리자 배치(POST /catalog/grow)와 매일 새벽 자동 실행. 사용자 요청 중엔 외부 API 를 부르지 않는다.
   씨앗: 최근 검색 기록(SearchLog)의 결과 가수 + 장르를 섞은 태그 + 애플 뮤직 한국·미국 차트.
   후보: 태그 인기곡(Last.fm), 비슷한 가수의 인기곡(Last.fm), 차트 곡.
   걸러내기: 커버·미리듣기가 있는 곡만(9/30 부터 한국 곡만 거르지 않는다 — 사용자 결정),
   같은 곡 다른 표기(JANNABI / 잔나비)는 미리듣기 주소로. 태그가 없으면 iTunes 장르(genres.ts).
   ponytail: 대기열은 메모리 — 서버를 끄면 남은 줄은 사라진다(다음 배치가 다시 채운다) */

const GAP_MS = 3100; // iTunes 는 분당 20회 남짓 — iTunes 를 부른 곡마다 쉰다
const DEFAULT_ADD = 30; // 한 번에 새로 담을 곡 수
const NIGHT_HOUR = 4; // 매일 새벽 4시(서버 시간)
// 장르를 섞어 둔다 — 한 장르로 몰리지 않게. 추천 점수엔 장르를 쓰지 않고, 곡을 찾는 데만 쓴다
const SEED_TAGS = ['k-indie', 'korean ballad', 'indie', 'dream pop', 'house', 'r&b', 'rock', 'jazz', 'city pop'];
const CHARTS = ['kr', 'us'].map((c) => `https://rss.marketingtools.apple.com/api/v2/${c}/music/most-played/50/songs.json`);

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
  start(target = DEFAULT_ADD) {
    if (this.status.running) return this.status;
    // 후보 모으기(몇 초)보다 먼저 진행 중으로 — 연달아 눌러도 두 번 돌지 않게
    this.status = { running: true, target, added: 0, tried: 0, queued: 0, startedAt: new Date().toISOString(), last: [] };
    void this.run(target).catch((e) => {
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
    for (const l of logs) {
      for (const [t, w] of Object.entries(JSON.parse(l.tags) as Tags)) tagScore.set(t, (tagScore.get(t) ?? 0) + w);
      for (const a of JSON.parse(l.artists) as string[]) artistCount.set(a, (artistCount.get(a) ?? 0) + 1);
    }
    const top = <K>(m: Map<K, number>, n: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
    let artists = top(artistCount, 4);
    // 검색 기록이 없으면 곡 풀에서 아무 가수나
    if (!artists.length) {
      const some = await this.prisma.track.findMany({ where: { tags: { not: '{}' } }, select: { artist: true }, take: 50 });
      artists = [...new Set(some.map((t) => t.artist))].sort(() => Math.random() - 0.5).slice(0, 4);
    }
    return { tags: [...new Set([...top(tagScore, 3), ...SEED_TAGS])], artists };
  }

  private async candidates(): Promise<Ref[]> {
    const { tags, artists } = await this.seeds();
    const similar = (await Promise.all(artists.map((a) => similarArtists(a, 4)))).flat();
    const lists = await Promise.all([
      ...similar.map((a) => artistTopTracks(a, 3)),
      ...CHARTS.map(chart),
      ...tags.map((t) => tagTopTracks(t, 20)),
    ]);
    const out: Ref[] = [];
    for (const r of interleave(lists)) {
      const k = keyOf(r);
      if (this.seen.has(k) || ALT_VERSION.test(r.title)) continue;
      this.seen.add(k);
      out.push(r);
    }
    return out;
  }

  private async run(target: number) {
    const queue = await this.candidates();
    this.status.queued = queue.length;
    this.log.log(`곡 풀 넓히기 시작 — 후보 ${queue.length}곡, 목표 ${target}곡`);
    try {
      while (queue.length && this.status.added < target) {
        const r = queue.shift()!;
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

  /** 곡 하나 — 담았으면 "가수 - 제목" */
  private async add(r: Ref): Promise<{ calledITunes: boolean; added: string | null }> {
    if (await this.prisma.track.findFirst({ where: { title: r.title, artist: r.artist } })) return { calledITunes: false, added: null };
    let tags = await fetchTags(r.title, r.artist);
    const it = await findOnITunes(r.title, r.artist);
    if (!it?.previewUrl || !it.artwork) return { calledITunes: true, added: null };
    // iTunes 가 반주 판을 줄 때도 있다(Last.fm 제목은 멀쩡해도 "비밀번호 486 (Instrumental)") — 받은 제목도 거른다
    if (ALT_VERSION.test(it.title)) return { calledITunes: true, added: null };
    // 태그는 곡 설명을 쓸 때 참고로만 — 없어도 담는다
    if (!Object.keys(tags).length) tags = genreTags(it.genre);
    // 같은 곡이 다른 표기로(JANNABI / 잔나비) 이미 있으면 — 미리듣기 주소가 같다
    if (await this.prisma.track.findFirst({ where: { previewUrl: it.previewUrl } })) return { calledITunes: true, added: null };
    // iTunes 표기를 곡 이름으로 쓴다 — 이미 있으면 태그만 채운다
    await this.prisma.track.upsert({
      where: { title_artist: { title: it.title, artist: it.artist } },
      create: { title: it.title, artist: it.artist, artwork: it.artwork, previewUrl: it.previewUrl, tags: JSON.stringify(tags) },
      update: { tags: JSON.stringify(tags) },
    });
    return { calledITunes: true, added: `${it.artist} - ${it.title}` };
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
