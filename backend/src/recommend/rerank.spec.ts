import { describe, expect, it } from 'vitest';
import { parse, promptFor } from './rerank.js';

const cands = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: `곡${id}`, artist: `가수${id}`, description: `설명${id}` }));

describe('재정렬', () => {
  it('번호 → id, 없는·겹친 번호는 버리고 빠진 후보는 1단계 순서로 뒤에', () => {
    const r = parse({ order: [3, 3, 9, 1, 0, 1.5], reasons: [{ n: 3, why: ' 결이 맞다 ' }, { n: 7, why: 'x' }], line_ko: '자네', line_en: 'You' }, cands);
    expect(r.order).toEqual(['c', 'a', 'b', 'd']);
    expect(r.reasons).toEqual({ c: '결이 맞다' });
    expect(r.line).toEqual({ ko: '자네', en: 'You' });
  });

  it('이상한 응답이면 1단계 순서 그대로, 한마디 없음', () => {
    const r = parse({ order: 'nope' as unknown as number[], line_ko: '자네' }, cands);
    expect(r.order).toEqual(['a', 'b', 'c', 'd']);
    expect(r.line).toBeNull();
  });

  it('프롬프트에 요청과 번호 붙은 후보가 들어간다', () => {
    const p = promptFor('비 오는 날', '감정: 쓸쓸함', cands);
    expect(p).toContain('사용자: 비 오는 날');
    expect(p).toContain('2. 가수b - 곡b\n설명b');
  });
});
