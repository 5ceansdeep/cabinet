import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { findOnITunes } from './itunes.js';
import { findYoutubeId } from './musicbrainz.js';
import { searchBudget, searchVideoId } from './youtube.js';

/* 곡 한 장을 갖추는 일 — 앨범 커버와 30초 미리듣기(iTunes), 유튜브 영상 ID(MusicBrainz).
   한 번 갖춘 곡은 DB 에 남겨 다시 찾지 않는다. 유튜브 검색 API(100 단위)는 여기서 부르지 않는다 */
@Injectable()
export class CatalogService {
  private readonly log = new Logger('Catalog');

  constructor(private readonly prisma: PrismaService) {}

  /** 이미 갖춰져 있으면 그대로 돌려주고, 빠진 것만 채운다 */
  async collect(title: string, artist: string, force = false) {
    const have = await this.prisma.track.findUnique({ where: { title_artist: { title, artist } } });
    if (have?.artwork && have.previewUrl && have.videoId && !force) return have;

    const itunes = have?.artwork && have.previewUrl && !force ? null : await findOnITunes(title, artist);
    // 영상 ID: 공짜인 MusicBrainz 를 먼저, 못 찾으면 유튜브 검색(100 단위, 하루 상한) — 한 번 찾으면 DB 에 남아 다시 안 찾는다
    const videoId =
      have?.videoId && !force ? have.videoId : ((await findYoutubeId(title, artist)) ?? (await searchVideoId(title, artist)));
    const data = {
      artwork: itunes?.artwork ?? have?.artwork ?? null,
      previewUrl: itunes?.previewUrl ?? have?.previewUrl ?? null,
      videoId: videoId ?? have?.videoId ?? null,
      checkedAt: new Date(),
    };
    this.log.log(`${artist} - ${title} → 커버 ${data.artwork ? 'O' : 'X'} 미리듣기 ${data.previewUrl ? 'O' : 'X'} 영상 ${data.videoId ?? 'X'}`);

    return this.prisma.track.upsert({
      where: { title_artist: { title, artist } },
      create: { title, artist, ...data },
      update: data,
    });
  }

  /** 여러 곡을 차례로 — MusicBrainz 가 초당 1회라 순서대로 돈다 */
  async collectMany(tracks: { title: string; artist: string }[], force = false) {
    const out = [];
    for (const t of tracks) out.push(await this.collect(t.title, t.artist, force));
    return out;
  }

  budget() {
    return searchBudget();
  }

  list() {
    return this.prisma.track.findMany({ orderBy: { artist: 'asc' } });
  }
}
