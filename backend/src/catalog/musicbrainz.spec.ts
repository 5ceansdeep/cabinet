import { describe, expect, it } from 'vitest';
import { pickName } from './musicbrainz.js';

const kr = (name: string, aliases: { name: string; locale?: string; type?: string; primary?: boolean }[] = []) => ({ name, score: 100, country: 'KR', aliases });

describe('pickName', () => {
  it('한글 이름은 그대로', () => expect(pickName([kr('검정치마')])).toBe('검정치마'));
  it('영문 이름이면 한국어 대표 별칭', () =>
    expect(pickName([kr('IU', [{ name: '이지은', locale: 'ko' }, { name: '아이유', locale: 'ko', primary: true }])])).toBe('아이유'));
  it('대표 별칭이 없으면 한국어 별칭, 그것도 없으면 MB 이름', () => {
    expect(pickName([kr('SE SO NEON', [{ name: '새소년', locale: 'ko', type: 'Artist name' }])])).toBe('새소년');
    const nj = [{ name: '엔제이지', locale: 'ko', type: 'Artist name' }, { name: '뉴진스', locale: 'ko', type: 'Artist name' }];
    expect(pickName([kr('NewJeans', nj)])).toBe('NewJeans'); // 예명이 여럿이면 못 고른다
    expect(pickName([kr('RM', [{ name: '김남준', locale: 'ko', type: 'Legal name' }])])).toBe('RM'); // 본명은 안 쓴다
    expect(pickName([kr('10cm', [{ name: '십센치' }])])).toBe('10cm');
  });
  it('확실한 한국 가수가 아니면 null — 동명이인에 안 끌려간다', () =>
    expect(pickName([{ name: 'George Frideric Handel', score: 100, country: 'GB' }, { ...kr('george'), score: 90 }])).toBeNull());
});
