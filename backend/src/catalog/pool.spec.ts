import { describe, expect, it } from 'vitest';
import { ALT_VERSION, interleave, tagPage } from './pool.js';

describe('곡 풀 후보 거르기', () => {
  it('반주만 거르고 리믹스·라이브·제목 속 단어는 살린다', () => {
    const drop = ['Scars leave beautiful trace (Instrumental)', 'Everything (Inst.)', '밤편지 (MR)', 'Song - Karaoke', '노래 (반주)'];
    const keep = ['Mr. Chu', 'LIVE WIRE', 'Love (Live)', 'Ditto (250 Remix)', 'Hype Boy - Remix', '난춘'];
    for (const t of drop) expect(ALT_VERSION.test(t), t).toBe(true);
    for (const t of keep) expect(ALT_VERSION.test(t), t).toBe(false);
  });

  it('출처별 목록에서 한 곡씩 번갈아 뽑는다', () => {
    expect(interleave([['a1', 'a2', 'a3'], ['b1'], ['c1', 'c2']])).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
  });

  it('태그 인기곡 쪽은 날마다 다음 쪽, 열흘이면 처음으로', () => {
    const day = (n: number) => new Date(n * 86_400_000);
    expect([0, 1, 9, 10, 11].map((n) => tagPage(day(n)))).toEqual([1, 2, 10, 1, 2]);
  });
});
