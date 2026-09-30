import { describe, expect, it } from 'vitest';
import { genreTags, inGenres } from './genres.js';

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

describe('inGenres', () => {
  it('고른 장르 중 하나라도 태그가 있으면 — 약한 태그는 빼고', () => {
    expect(inGenres({ 'k-indie': 100, korean: 80 }, ['indie'])).toBe(true);
    expect(inGenres({ 'k-pop': 100 }, ['jazz', 'jpop'])).toBe(false);
    expect(inGenres({ jazz: 5, 'k-pop': 100 }, ['jazz'])).toBe(false);
    expect(inGenres({ House: 50 }, ['house'])).toBe(true);
    expect(inGenres({}, [])).toBe(true);
  });
});
