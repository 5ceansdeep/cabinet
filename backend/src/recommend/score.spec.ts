import { describe, expect, it } from 'vitest';
import { cosine, push } from './score.js';

describe('score', () => {
  it('같은 태그면 1, 겹치는 게 없으면 0', () => {
    expect(cosine({ indie: 100 }, { indie: 50 })).toBeCloseTo(1);
    expect(cosine({ indie: 100 }, { jazz: 100 })).toBe(0);
    expect(cosine({}, { jazz: 100 })).toBe(0);
  });

  it('pick 이면 그 태그만 본다', () => {
    const pick = new Set(['sad']);
    expect(cosine({ sad: 100, rock: 100 }, { sad: 10, jazz: 90 }, pick)).toBeCloseTo(1);
  });

  it('던진 곡의 태그는 요청에서 깎인다', () => {
    const q = push({ indie: 100, sad: 100 }, [{ sad: 100 }]);
    expect(q.sad).toBeLessThan(100);
    expect(q.indie).toBe(100);
    expect(cosine(q, { sad: 100 })).toBeLessThan(cosine({ indie: 100, sad: 100 }, { sad: 100 }));
  });
});
