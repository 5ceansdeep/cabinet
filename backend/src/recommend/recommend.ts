import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Tags } from '../catalog/lastfm.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { interpret, MOOD } from './interpret.js';
import { cosine, push } from './score.js';

/* 요청문 → 태그(해석) → 갖춰 둔 곡마다 태그 겹침 점수 → 상위 몇 곡.
   숫자는 전부 코드가 계산한다 (LLM 은 나중에 해석·문장만). 서랍에 넣을 곡 목록이 곧 이 결과다 */

const ids = (s?: string) => (s ? s.split(',').filter(Boolean) : []);

@Injectable()
export class RecommendService {
  constructor(private readonly prisma: PrismaService) {}

  async recommend(query: string, opts: { seen?: string[]; thrown?: string[]; limit?: number } = {}) {
    const { seen = [], thrown = [], limit = 6 } = opts;
    const pool = await this.prisma.track.findMany({ where: { tags: { not: '{}' } } });
    const tagsOf = new Map(pool.map((t) => [t.id, JSON.parse(t.tags) as Tags]));

    const asked = interpret(query);
    // 던진 곡이 있으면 그 곡들 쪽에서 멀어지게 요청을 민다
    const want = thrown.length ? push(asked, thrown.map((id) => tagsOf.get(id) ?? {})) : asked;
    const skip = new Set([...seen, ...thrown]);

    const tracks = pool
      .filter((t) => !skip.has(t.id))
      .map((t) => {
        const tags = tagsOf.get(t.id)!;
        return {
          id: t.id,
          title: t.title,
          artist: t.artist,
          artwork: t.artwork,
          previewUrl: t.previewUrl,
          videoId: t.videoId,
          semantic: Math.max(0, Math.round(cosine(want, tags) * 100)),
          mood: Math.max(0, Math.round(cosine(want, tags, MOOD) * 100)),
          matched: Object.keys(asked).filter((k) => tags[k]), // 요청과 겹친 태그 — 보고서의 근거
        };
      })
      .sort((a, b) => b.semantic - a.semantic || b.mood - a.mood)
      .slice(0, limit);

    return { interpretation: asked, tracks };
  }
}

@ApiTags('recommend')
@Controller('recommend')
export class RecommendController {
  constructor(private readonly svc: RecommendService) {}

  @Get()
  @ApiOperation({ summary: '요청문으로 곡 꺼내기 — 요청 해석 태그 + 곡별 일치 점수' })
  @ApiQuery({ name: 'q', example: '새벽에 혼자 걷는 기분' })
  @ApiQuery({ name: 'seen', required: false, description: '이미 보여 준 곡 id(쉼표) — "몇 곡 더"' })
  @ApiQuery({ name: 'thrown', required: false, description: '던져 버린 곡 id(쉼표) — 빼고, 그 곡들 쪽에서 멀어진다' })
  get(@Query('q') q = '', @Query('seen') seen?: string, @Query('thrown') thrown?: string) {
    return this.svc.recommend(q, { seen: ids(seen), thrown: ids(thrown) });
  }
}

@Module({ controllers: [RecommendController], providers: [RecommendService] })
export class RecommendModule {}
