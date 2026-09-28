import { describe, expect, it } from 'vitest';
import { pick } from './itunes.js';

const r = (trackName: string, artistName: string, artistId?: number) => ({ trackName, artistName, artistId });

describe('iTunes 검색 결과 고르기', () => {
  it('첫 결과가 다른 가수면 건너뛰고 아티스트가 맞는 곡을 고른다', () => {
    const results = [r('Everything', 'Other Band'), r('Everything', '검정치마 (The Black Skirts)')];
    expect(pick(results, 'Everything', '검정치마')?.artistName).toBe('검정치마 (The Black Skirts)');
  });

  it('같은 가수의 곡이 여럿이면 제목까지 맞는 것을 고른다', () => {
    const results = [r('Hollywood', '검정치마'), r('Everything', '검정치마')];
    expect(pick(results, 'everything', '검정치마')?.trackName).toBe('Everything');
  });

  it('영문 이름·번역 제목이어도 가수 번호가 맞으면 고른다 (실제 미국 스토어 결과)', () => {
    const results = [r('Run Away', 'MC MONG', 1), r('Run with Me', 'sunwoojunga', 2), r('Run With Me', 'Roy Kim', 3)];
    expect(pick(results, '도망가자', '선우정아', 2)?.artistName).toBe('sunwoojunga');
  });

  it('가수가 맞는 게 하나도 없으면 엉뚱한 표지 대신 null', () => {
    expect(pick([r('Everything', 'Other Band', 9)], 'Everything', '검정치마', 1)).toBeNull();
  });
});
