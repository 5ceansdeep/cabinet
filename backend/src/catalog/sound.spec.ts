import { describe, expect, it } from 'vitest';
import { parseSound } from './sound.js';

describe('parseSound', () => {
  it('쓸 숫자만 남긴다', () => {
    const json = { acousticness: 0.516, danceability: 0.6175, energy: 0.2373, instrumentalness: 0.64, tempo: 114.49, valence: 0.2883 };
    expect(parseSound(json)).toEqual({ energy: 0.2373, valence: 0.2883, danceability: 0.6175, acousticness: 0.516, tempo: 114.49 });
  });

  it('하나라도 빠지거나 숫자가 아니면 null', () => {
    expect(parseSound({ energy: 0.2, valence: 0.3, danceability: 0.5, acousticness: 0.1 })).toBeNull();
    expect(parseSound({ energy: '0.2', valence: 0.3, danceability: 0.5, acousticness: 0.1, tempo: 90 })).toBeNull();
    expect(parseSound(null)).toBeNull();
  });
});
