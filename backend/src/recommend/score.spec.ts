import { describe, expect, it } from 'vitest';
import { A, away, HUB, hubPenalties, display, dot, lexical, rank, soundScore, TASTE_BONUS, tasteBonus, throwPenalties, throwPenalty, total } from './score.js';

describe('score', () => {
  it('허브 — 고른 몫의 몇 배를 넘게 나온 곡만 깎고, 곡 풀이 커지면 같은 횟수도 더 깎인다', () => {
    const shown = new Map([['hub', 40], ['fair', 5]]);
    const small = hubPenalties(shown, 300, 800, 10); // 고른 몫 1.25% — hub 는 13.3%(10.7배)
    expect(small.get('hub')).toBeCloseTo(HUB.step * Math.log2(40 / 300 / (10 / 800) / HUB.from));
    expect(small.has('fair')).toBe(false);
    expect(hubPenalties(shown, 300, 3200, 10).get('hub')!).toBeGreaterThan(small.get('hub')!);
    expect(hubPenalties(new Map([['x', 30]]), 30, 800, 10).size).toBe(0); // 검색이 적으면 안 깎는다
    expect(hubPenalties(new Map([['x', 300]]), 300, 800, 10).get('x')).toBe(HUB.max);
  });

  it('좋아요한 곡과 결이 가까운 곡만 가산 — 좋아요가 없으면 빈 표', () => {
    const pool = [
      { id: 'a', vector: [1, 0] },
      { id: 'b', vector: [0.96, 0.28] },
      { id: 'c', vector: [0, 1] },
      { id: 'd', vector: [-1, 0] },
    ];
    expect(tasteBonus(pool, []).size).toBe(0);
    const m = tasteBonus(pool, ['a']);
    expect(m.get('a')).toBeCloseTo(TASTE_BONUS);
    expect(m.get('b')!).toBeGreaterThan(m.get('c')!);
    expect(m.get('d')).toBe(0);
  });

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

  it('던진 곡 감점은 던진 편지가 지금 편지와 비슷할수록 — 벡터 없는 예전 기록은 한 번으로', () => {
    const letter = [1, 0];
    const at = (cos: number) => [cos, Math.sqrt(1 - cos * cos)]; // 지금 편지와 코사인 cos 인 편지
    const p = throwPenalties(
      [
        { trackId: 'same', vector: at(0.96) },
        { trackId: 'half', vector: at(0.875) },
        { trackId: 'other', vector: at(0.72) },
        { trackId: 'old', vector: null },
      ],
      letter,
    );
    expect(p.get('same')).toBeCloseTo(0.01);
    expect(p.get('half')).toBeCloseTo(0.005);
    expect(p.has('other')).toBe(false);
    expect(p.get('old')).toBeCloseTo(0.01);
  });

  it('화면 일치도는 60~99 로 늘린다', () => {
    expect(display(0.93, 0.8, 0.93)).toBe(99);
    expect(display(0.8, 0.8, 0.93)).toBe(60);
    expect(display(0.5, 0.5, 0.5)).toBe(99);
  });
});

describe('글자 일치 가산', () => {
  const b = { title: 0.1, key: 0.04 };
  it('제목에 있으면 크게, [핵심어]에 있으면 작게, 없으면 0', () => {
    expect(lexical({ title: 'Crazy (feat. X)' }, ['미친', 'crazy'], b)).toBe(0.1);
    expect(lexical({ title: 'Song', description: '감정: [불안, 미친 듯이, 강렬함] …' }, ['미친'], b)).toBe(0.04);
    expect(lexical({ title: 'Song', description: '감정: [평온] 미친 듯한 문장 속 낱말' }, ['미친'], b)).toBe(0);
    expect(lexical({ title: 'Song' }, [], b)).toBe(0);
  });
});
