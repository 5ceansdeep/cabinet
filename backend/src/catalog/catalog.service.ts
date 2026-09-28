import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { findOnITunes } from './itunes.js';
import { fetchTags } from './lastfm.js';
import { searchBudget } from './youtube.js';

/* 곡 한 장을 갖추는 일 — 앨범 커버와 30초 미리듣기(iTunes), 태그(Last.fm). 한 번 갖춘 곡은 DB 에 남겨 다시 찾지 않는다.
   유튜브 영상 ID 는 여기서 찾지 않는다 — 재생목록을 만들 때와 밤 배치(videos.ts)에서만. 안 쓰일 곡에 할당량을 쓰지 않게 */
@Injectable()
export class CatalogService {
  private readonly log = new Logger('Catalog');

  constructor(private readonly prisma: PrismaService) {}

  /** 이미 갖춰져 있으면 그대로 돌려주고, 빠진 것만 채운다 */
  async collect(title: string, artist: string, force = false) {
    const have = await this.prisma.track.findUnique({ where: { title_artist: { title, artist } } });
    const hasTags = !!have && have.tags !== '{}';
    if (have?.artwork && have.previewUrl && hasTags && !force) return have;

    const itunes = have?.artwork && have.previewUrl && !force ? null : await findOnITunes(title, artist);
    const tags = hasTags && !force ? have.tags : JSON.stringify(await fetchTags(title, artist));
    const data = {
      tags,
      artwork: itunes?.artwork ?? have?.artwork ?? null,
      previewUrl: itunes?.previewUrl ?? have?.previewUrl ?? null,
    };
    this.log.log(`${artist} - ${title} → 커버 ${data.artwork ? 'O' : 'X'} 미리듣기 ${data.previewUrl ? 'O' : 'X'} 태그 ${Object.keys(JSON.parse(tags)).length}`);

    return this.prisma.track.upsert({
      where: { title_artist: { title, artist } },
      create: { title, artist, ...data },
      update: data,
    });
  }

  /** 여러 곡을 차례로 — iTunes 가 몰아치는 호출을 싫어해 순서대로 돈다 */
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
