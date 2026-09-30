import { describe, expect, it } from 'vitest';
import { describeText, promptFor } from './describe.js';
import { retryAfter, unit } from './gemini.js';
import { pickLyrics } from './lyrics.js';

const row = { id: 'x', title: '난춘', artist: '새소년', tags: '{"k-indie":100,"korean":80}', energy: 0.31, valence: 0.7, acousticness: null };

describe('곡 설명', () => {
  it('프롬프트에 곡·소리 숫자·태그·가사가 들어간다', () => {
    const p = promptFor(row, '가사 한 줄');
    expect(p).toContain('새소년 - 난춘');
    expect(p).toContain('에너지 0.31(낮음), 밝기 0.70(높음)');
    expect(p).toContain('k-indie, korean');
    expect(p).toContain('가사:\n가사 한 줄');
  });

  it('소리 숫자·가사가 없으면 없음이라고 쓴다', () => {
    const p = promptFor({ ...row, energy: null, tags: '{}' }, null);
    expect(p).toContain('소리 숫자: 없음');
    expect(p).toContain('가사: 없음');
    expect(p).not.toContain('태그');
  });

  it('설명은 네 줄 틀', () => {
    expect(describeText({ emotion: 'a', situation: 'b', lyrics: 'c', sound: 'd' })).toBe('감정: a\n상황: b\n가사: c\n소리: d');
  });
});

describe('가사 고르기', () => {
  const hit = (a: string, t: string, lyrics: string | null, instrumental = false) => ({ artistName: a, trackName: t, plainLyrics: lyrics, instrumental });
  it('가수·제목이 맞고 가사가 있는 곡만', () => {
    expect(pickLyrics([hit('다른가수', '난춘', 'x'), hit('새소년', '난춘', null), hit('새소년 (SE SO NEON)', '난춘', ' 진짜 ')], '난춘', '새소년')).toBe('진짜');
    expect(pickLyrics([hit('새소년', '난춘', 'x', true)], '난춘', '새소년')).toBeNull();
  });
});

describe('Gemini 도우미', () => {
  it('429 대기 시간', () => {
    expect(retryAfter('Please retry in 54.12s.')).toBe(54120);
    expect(retryAfter('"retryDelay": "7s"')).toBe(7000);
    expect(retryAfter('quota exceeded')).toBeNull();
  });
  it('길이 1 로', () => {
    expect(unit([3, 4])).toEqual([0.6, 0.8]);
  });
});
