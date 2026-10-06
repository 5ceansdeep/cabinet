import { describe, expect, it } from 'vitest';
import { describeText, outOfCredit, promptFor } from './describe.js';
import { retryAfter, unit } from './gemini.js';
import { pickLyrics } from './lyrics.js';

const row = { id: 'x', title: '난춘', artist: '새소년', tags: '{"k-indie":100,"korean":80}', energy: 0.31, valence: 0.7, acousticness: null, danceability: 0.55, tempo: 92.4 };

describe('곡 설명', () => {
  it('프롬프트에 곡·소리 숫자·태그·가사가 들어간다', () => {
    const p = promptFor(row, { text: '가사 한 줄', instrumental: false });
    expect(p).toContain('새소년 - 난춘');
    expect(p).toContain('에너지 0.31(낮음), 밝기 0.70(높음), 춤추기 좋음 0.55(중간), 빠르기 92 BPM');
    expect(p).toContain('k-indie, korean');
    expect(p).toContain('가사:\n가사 한 줄');
  });

  it('소리 숫자가 없으면 없음, 가사를 못 찾았으면 연주곡이라 하지 말라고', () => {
    const p = promptFor({ ...row, energy: null, valence: null, danceability: null, tempo: null, tags: '{}' }, null);
    expect(p).toContain('소리 숫자: 없음');
    expect(p).toContain('가사: 못 찾음');
    expect(p).not.toContain('태그');
  });

  it('연주곡 기록이 있을 때만 연주곡', () => {
    expect(promptFor(row, { text: null, instrumental: true })).toContain('노래 없는 연주곡이다');
  });

  it('설명은 네 줄 틀', () => {
    expect(describeText({ emotion: 'a', situation: 'b', lyrics: 'c', sound: 'd' })).toBe('감정: a\n상황: b\n가사: c\n소리: d');
  });
});

describe('크레딧 바닥', () => {
  it('402 만 바닥으로 본다 — 한도(429)·서버 오류는 아니다', () => {
    expect(outOfCredit(new Error('Gemini 실패 — gemini-3.8-flash 402 Your prepayment credits are depleted'))).toBe(true);
    expect(outOfCredit(new Error('Gemini 실패 — gemini-3.8-flash 429 retry in 54s'))).toBe(false);
    expect(outOfCredit(new Error('Gemini 실패 — gemini-3.8-flash 503 4020'))).toBe(false);
  });
});

describe('가사 고르기', () => {
  const hit = (a: string, t: string, lyrics: string | null, instrumental = false) => ({ artistName: a, trackName: t, plainLyrics: lyrics, instrumental });
  it('가수·제목이 맞고 가사가 있는 곡만', () => {
    expect(pickLyrics([hit('다른가수', '난춘', 'x'), hit('새소년', '난춘', null), hit('새소년 (SE SO NEON)', '난춘', ' 진짜 ')], '난춘', '새소년')).toEqual({
      text: '진짜',
      instrumental: false,
    });
  });
  it('연주곡 기록만 있으면 연주곡, 맞는 곡이 없으면 못 찾음(null)', () => {
    expect(pickLyrics([hit('Dave Brubeck', 'Take Five', null, true)], 'Take Five', 'Dave Brubeck')).toEqual({ text: null, instrumental: true });
    expect(pickLyrics([hit('다른가수', 'Take Five', null, true)], 'Take Five', 'Dave Brubeck')).toBeNull();
  });
  it('굽은 따옴표도 같은 이름', () => {
    expect(pickLyrics([hit("Linus' Blanket", 'Labor in Vain', 'x')], 'Labor in Vain', 'Linus’ Blanket')?.text).toBe('x');
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
