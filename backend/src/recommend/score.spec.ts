import { describe, expect, it } from 'vitest';
import { A, away, dot, soundScore, total } from './score.js';

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
});
