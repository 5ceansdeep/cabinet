import { describe, expect, it, vi } from 'vitest';

const search = vi.fn();
vi.mock('./youtube.js', () => ({ PT: 'America/Los_Angeles', searchBudget: () => ({ used: 0, left: 10 }), searchVideoId: search }));
const { VideoService } = await import('./videos.js');

const prisma = { track: { update: vi.fn() } };
const svc = new VideoService(prisma as never);
const row = (id: string, extra: object = {}) => ({ id, title: id, artist: 'a', videoId: null, checkedAt: null, ...extra });

describe('VideoService.ensure', () => {
  it('아는 곡·최근에 못 찾은 곡은 묻지 않고, 모르는 곡만 묻는다', async () => {
    search.mockReset().mockResolvedValue({ id: 'vid' });
    const { tracks } = await svc.ensure([row('known', { videoId: 'x' }), row('recent', { checkedAt: new Date() }), row('new')]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(tracks.map((t) => t.videoId)).toEqual(['x', null, 'vid']);
  });

  it('상한에 걸리면(null) 그 뒤로는 묻지 않는다', async () => {
    search.mockReset().mockResolvedValueOnce(null);
    const { tracks, exhausted } = await svc.ensure([row('a'), row('b')]);
    expect(exhausted).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
    expect(tracks.every((t) => t.videoId === null)).toBe(true);
  });
});
