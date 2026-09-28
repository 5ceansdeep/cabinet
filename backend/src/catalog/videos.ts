import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PT, searchBudget, searchVideoId } from './youtube.js';

/* 유튜브 영상 ID — 필요할 때 찾고, 한 번 찾으면 영구 보관한다.
   1) 재생목록을 만들 때: 그 서랍 곡 중 모르는 것만 찾는다
   2) 밤 배치: 하루 할당량은 태평양 자정에 풀리니, 풀리기 30분 전 남은 몫으로 서랍에 많이 담긴 곡부터 미리 찾아 둔다
   못 찾은 곡은 RETRY_DAYS 동안 다시 묻지 않는다(검색 한 번 = 100 단위). 추천은 DB 곡 풀 안에서만 나오니 총비용의 상한은 풀 크기다 */

const RETRY_DAYS = 30;
const NIGHT_AT = 23 * 60 + 30; // 태평양 시간 23:30

type Row = { id: string; title: string; artist: string; videoId: string | null; checkedAt: Date | null };

export const watchUrl = (ids: string[]) => `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}`;
export const searchUrl = (t: { title: string; artist: string }) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t.artist} ${t.title}`)}`;

// 물어볼 만한 곡 — 모르고, 최근에 못 찾은 적도 없는 곡
const stale = () => new Date(Date.now() - RETRY_DAYS * 86_400_000);
const askable = (t: Row) => !t.videoId && (!t.checkedAt || t.checkedAt < stale());

@Injectable()
export class VideoService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Video');
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly prisma: PrismaService) {}

  /** 곡들의 영상 ID 를 채운다 — 오늘 상한에 걸리면 거기서 멈춘다. 채운 뒤의 곡들을 같은 순서로 돌려준다 */
  async ensure<T extends Row>(tracks: T[]): Promise<{ tracks: T[]; exhausted: boolean }> {
    let exhausted = false;
    const out: T[] = [];
    for (const t of tracks) {
      if (exhausted || !askable(t)) {
        out.push(t);
        continue;
      }
      const found = await searchVideoId(t.title, t.artist);
      if (!found) {
        exhausted = true; // 키 없음·상한·오류 — 오늘은 더 묻지 않는다
        out.push(t);
        continue;
      }
      await this.prisma.track.update({ where: { id: t.id }, data: { videoId: found.id, checkedAt: new Date() } });
      out.push({ ...t, videoId: found.id, checkedAt: new Date() });
    }
    return { tracks: out, exhausted };
  }

  /** 밤 배치 — 남은 몫만큼, 서랍에 많이 담긴 곡부터 */
  async fillNight() {
    const left = searchBudget().left;
    if (!left || !process.env.YOUTUBE_API_KEY) return;
    const rows = await this.prisma.track.findMany({
      where: { videoId: null, OR: [{ checkedAt: null }, { checkedAt: { lt: stale() } }] },
      orderBy: { shelves: { _count: 'desc' } },
      take: left,
    });
    const { tracks } = await this.ensure(rows);
    this.log.log(`밤 배치 — ${rows.length}곡 물어 ${tracks.filter((t) => t.videoId).length}곡 영상 찾음 (남은 검색 ${searchBudget().left})`);
  }

  // 태평양 시간 23:30 마다 — 할당량이 풀리기 직전, 낮에 안 쓴 몫을 쓴다
  onModuleInit() {
    const now = new Date();
    const [h, m] = now.toLocaleTimeString('en-GB', { timeZone: PT, hour12: false }).split(':').map(Number);
    const mins = (NIGHT_AT - (h * 60 + m) + 1440) % 1440 || 1440;
    this.timer = setTimeout(() => {
      void this.fillNight().catch((e) => this.log.warn(`밤 배치 실패: ${e}`)).finally(() => this.onModuleInit());
    }, mins * 60_000);
  }

  onModuleDestroy() {
    clearTimeout(this.timer);
  }
}
