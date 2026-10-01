import { describe, expect, it } from 'vitest';
import { A, away, display, dot, rank, soundScore, throwPenalty, total } from './score.js';

describe('score', () => {
  it('길이 1 벡터의 내적 = 코사인', () => {
    expect(dot([1, 0], [1, 0])).toBe(1);
    expect(dot([1, 0], [0, 1])).toBe(0);
  });

  it('소리는 요청이 말한 축만, ±0.1 안쪽은 차이 없음', () => {
    expect(soundScore({ energy: 0.25, valence: 0.9 }, { energy: 0.2, valence: null })).toBe(1);
    expect(soundScore({ energy: 0.9, valence: 0.5 }, { energy: 0.2, valence: null })).toBeCloseTo(0.4);
    expect(soundScore({ energy: null, valence: null }, { energy: 0.2, valence: 0.3 })).toBeNull();
    expect(soundScore({ energy: 0.5, valence: 0.5 }, { energy: null, valence: null })).toBeNull();
  });

  it('소리를 못 재면 뜻만', () => {
    expect(total(0.8, null)).toBe(0.8);
    expect(total(0.8, 0.5)).toBeCloseTo(A * 0.8 + (1 - A) * 0.5);
  });

  it('던진 곡 쪽에서 멀어진다', () => {
    const q = [Math.SQRT1_2, Math.SQRT1_2];
    const thrown = [1, 0];
    const pushed = away(q, [thrown]);
    expect(dot(pushed, thrown)).toBeLessThan(dot(q, thrown));
    expect(Math.hypot(...pushed)).toBeCloseTo(1);
    expect(away(q, [])).toBe(q);
  });

  it('순위 — 본 곡·던진 곡은 빼고, 가수당 두 곡까지 먼저', () => {
    const t = (id: string, artist: string, vector: number[]) => ({ id, artist, vector, energy: null, valence: null });
    const pool = [t('a1', 'a', [1, 0]), t('a2', 'a', [0.99, 0.14]), t('a3', 'a', [0.98, 0.2]), t('b1', 'b', [0.8, 0.6]), t('c1', 'c', [0, 1])];
    const want = { vector: [1, 0], energy: null, valence: null };
    expect(rank(pool, want, { center: false }).map((x) => x.id)).toEqual(['a1', 'a2', 'b1', 'c1', 'a3']);
    expect(rank(pool, want, { seen: ['a1', 'a3'], thrown: ['c1'], center: false }).map((x) => x.id)).toEqual(['a2', 'b1']);
    // 자주 던져진 곡은 조금 내려간다 — 근소한 차이만 뒤집는다
    const penalty = new Map([['a1', throwPenalty(2)]]);
    expect(rank(pool, want, { center: false, penalty }).map((x) => x.id).slice(0, 3)).toEqual(['a2', 'a1', 'b1']);
    expect(throwPenalty(1000)).toBe(0.05);
  });

  it('화면 일치도는 60~99 로 늘린다', () => {
    expect(display(0.93, 0.8, 0.93)).toBe(99);
    expect(display(0.8, 0.8, 0.93)).toBe(60);
    expect(display(0.5, 0.5, 0.5)).toBe(99);
  });
});
