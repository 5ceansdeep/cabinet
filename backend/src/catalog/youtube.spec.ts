import { describe, expect, it } from 'vitest';
import { pickVideo } from './youtube.js';

const v = (videoId: string, title: string, channelTitle = 'x') => ({ id: { videoId }, snippet: { title, channelTitle } });

describe('pickVideo', () => {
  it('라이브·방송 무대는 거르고 원곡을 고른다', () => {
    const items = [v('live', '10CM - 그라데이션 [유희열의 스케치북/You Heeyeol’s Sketchbook]', 'KBS Kpop'), v('mv', '[MV] 10CM - 그라데이션')];
    expect(pickVideo(items, '그라데이션', '10CM')).toBe('mv');
  });
  it('Topic 채널이 먼저', () => {
    expect(pickVideo([v('a', '난춘'), v('t', '난춘', '새소년 - Topic')], '난춘', '새소년')).toBe('t');
  });
  it('곡 제목이 라이브면 라이브도 받는다', () => {
    expect(pickVideo([v('l', 'Song (Live)')], 'Song (Live)', 'a')).toBe('l');
  });
  it('전부 라이브면 null — 못 찾은 곡으로 남긴다', () => {
    expect(pickVideo([v('l', 'Song LIVE')], 'Song', 'a')).toBeNull();
  });
});
