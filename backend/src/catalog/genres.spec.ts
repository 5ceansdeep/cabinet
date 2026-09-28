import { describe, expect, it } from 'vitest';
import { genreTags } from './genres.js';

describe('genreTags', () => {
  it('iTunes 장르를 Last.fm 태그로 — 대소문자·한국어 장르도', () => {
    expect(genreTags('K-Pop')).toEqual({ 'k-pop': 100, korean: 100 });
    expect(genreTags('발라드')).toEqual({ ballad: 100, korean: 100 });
  });
  it('모르는 장르·없음은 빈 태그', () => {
    expect(genreTags('Spoken Word')).toEqual({});
    expect(genreTags(null)).toEqual({});
  });
});
