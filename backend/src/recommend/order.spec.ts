import { describe, expect, it } from 'vitest';
import { alternate, arrange, blend, by, finalOrder, later, Limiter, pinTitled, sameTitle } from './recommend.js';

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

describe('같은 편지 다시', () => {
  const xs = [
    { id: 'a', artist: 'Oasis', title: 'Wonderwall' },
    { id: 'b', artist: '아이유', title: '밤편지' },
    { id: 'c', artist: '검정치마', title: 'Everything' },
  ];
  it('전에 보여 준 곡은 뒤로, 나머지 순서는 그대로', () => {
    expect(later(xs, new Set(['Oasis - Wonderwall'])).map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('편지에 쓴 가수 곡은 안 미룬다', () => {
    expect(later(xs, new Set(['Oasis - Wonderwall']), ['Oasis']).map((x) => x.id)).toEqual(['a', 'b', 'c']);
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

describe('제목 일치 고정', () => {
  const xs = [{ id: 'a', title: 'Rush' }, { id: 'b', title: 'Crazy (feat. X)' }, { id: 'c', title: 'Step' }];
  it('제목에 요청 낱말이 든 곡을 맨 앞에', () => {
    expect(pinTitled(xs, { words: ['crazy'] }).map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });
  it('가수를 말했거나 낱말이 없으면 그대로', () => {
    expect(pinTitled(xs, { words: ['crazy'], artists: ['Oasis'] }).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(pinTitled(xs, {}).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('꼽은 곡 찾기', () => {
  it('괄호·기호·대소문자는 무시하고 같은 제목', () => {
    expect(sameTitle('Everything', 'everything')).toBe(true);
    expect(sameTitle('Crazy (feat. BANG YONGGUK)', 'Crazy')).toBe(true);
    expect(sameTitle('Shine Your Light', 'shine-your-light')).toBe(true);
    expect(sameTitle('야생화', '눈의 꽃')).toBe(false);
    expect(sameTitle('', 'x')).toBe(false);
  });
  it('요청 벡터와 꼽은 곡 벡터를 반반 섞어 길이 1', () => {
    const v = blend([1, 0], [[0, 1]]);
    expect(v[0]).toBeCloseTo(Math.SQRT1_2);
    expect(v[1]).toBeCloseTo(Math.SQRT1_2);
  });
});

describe('가수 다른 표기', () => {
  it('곡 풀 표기와 다른 표기 어느 쪽으로 불러도 그 가수', () => {
    const t = { artist: '엔시티 드림', artistAlt: 'NCT DREAM' };
    expect(by(t, 'NCT')).toBe(true);
    expect(by(t, '엔시티')).toBe(true);
    expect(by({ artist: 'NewJeans', artistAlt: '뉴진스 · 엔제이지' }, '뉴진스')).toBe(true);
    expect(by({ artist: '엔시티 드림' }, 'NCT')).toBe(false);
    expect(by(t, 'BTS')).toBe(false);
    expect(by({ artist: '보아', artistAlt: 'BoA' }, 'Boards of Canada')).toBe(false); // 짧은 로마자 이름이 글자만 겹치는 이름에 안 걸린다
    expect(by({ artist: '에프엑스', artistAlt: 'f(x)' }, 'fx')).toBe(true);
  });
  it('원래 표기도 낱말 단위 — 글자만 겹치는 이름엔 안 걸린다', () => {
    expect(by({ artist: 'Kali Uchis' }, 'IU')).toBe(false);
    expect(by({ artist: 'BoA & Beenzino' }, 'Beenzino')).toBe(true);
    expect(by({ artist: 'JAŸ-Z' }, 'Jay-Z')).toBe(true);
    expect(by({ artist: '방탄소년단' }, '방탄')).toBe(true);
    expect(by({ artist: '검정치마 (The Black Skirts)' }, '검정치마')).toBe(true);
  });
});

describe('섞인 장르', () => {
  const t = (artist: string, ...tags: string[]) => ({ artist, tags: JSON.stringify(Object.fromEntries(tags.map((x) => [x, 100]))) });
  it('장르를 둘 말하면 둘 다 가진 곡이 먼저, 나머지는 번갈아 — 한 장르가 다 차지하지 않는다', () => {
    const all = [t('j1', 'jazz'), t('j2', 'jazz'), t('j3', 'jazz'), t('h1', 'hip-hop'), t('both', 'jazz', 'rap'), t('r', 'rock'), ...Array.from({ length: 8 }, (_, i) => t(`j${i + 4}`, 'jazz'))];
    expect(arrange(all, { genres: ['jazz', 'hiphop'] }).slice(0, 4).map((x) => x.artist)).toEqual(['both', 'j1', 'h1', 'j2']);
    expect(arrange(all, { genres: ['jazz'] }).slice(0, 3).map((x) => x.artist)).toEqual(['j1', 'j2', 'j3']); // 하나면 예전대로 점수순
  });
});
