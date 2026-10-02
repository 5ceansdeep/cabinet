import { describe, expect, it } from 'vitest';
import { alternate, finalOrder, Limiter } from './recommend.js';

const t = (id: string, artist: string) => ({ id, artist });
const cands = [t('a', 'Oasis'), t('b', '아이유'), t('c', 'Oasis'), t('d', '검정치마')];

describe('재정렬 순서', () => {
  it('재정렬이 매긴 순서대로', () => {
    expect(finalOrder(cands, ['d', 'b', 'a', 'c']).map((x) => x.id)).toEqual(['d', 'b', 'a', 'c']);
  });
  it('말한 가수 곡은 재정렬과 상관없이 맨 앞(1단계 순서대로)', () => {
    expect(finalOrder(cands, ['d', 'c', 'b', 'a'], ['오아시스', 'Oasis']).map((x) => x.id)).toEqual(['a', 'c', 'd', 'b']);
  });
  it('후보에 없는 번호는 버린다', () => {
    expect(finalOrder(cands, ['z', 'b']).map((x) => x.id)).toEqual(['b']);
  });
});

describe('Gemini 요청 제한', () => {
  it('분당·하루 상한을 넘으면 막고, 1분 지나면 다시', () => {
    const l = new Limiter(2, 3);
    expect([l.hit('a', 0), l.hit('a', 1), l.hit('a', 2), l.hit('b', 2)]).toEqual([true, true, false, true]);
    expect(l.hit('a', 60_001)).toBe(true); // 분당은 풀렸고 하루 3번째
    expect(l.hit('a', 200_000)).toBe(false); // 하루 3번 다 씀
    expect(l.hit('a', 86_400_002)).toBe(true); // 하루 지남
  });
});

describe('두 읽기 번갈아', () => {
  it('두 줄에서 번갈아, 겹치는 곡은 한 번만', () => {
    const a = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const b = [{ id: 'x' }, { id: 'a' }, { id: 'y' }];
    expect(alternate(a, b).map((t) => t.id)).toEqual(['a', 'x', 'b', 'c', 'y']);
  });
});
