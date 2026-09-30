import { same } from './itunes.js';

/* 가사 — LRCLIB(키 없음). 곡 설명을 만드는 데만 쓰고 저장·화면 표시는 하지 않는다(저작권).
   ponytail: 같은 제목 다른 곡은 가수·제목이 둘 다 맞는지로만 거른다 — 곡 길이 비교는 Track 에 길이가 없어 못 한다 */

type Hit = { trackName: string; artistName: string; instrumental: boolean; plainLyrics: string | null };

/** 결과 중 가수·제목이 맞고 가사가 있는 첫 곡 */
export function pickLyrics(hits: Hit[], title: string, artist: string): string | null {
  const hit = hits.find((h) => !h.instrumental && h.plainLyrics?.trim() && same(h.artistName, artist) && same(h.trackName, title));
  return hit?.plainLyrics?.trim() ?? null;
}

export async function findLyrics(title: string, artist: string): Promise<string | null> {
  try {
    const res = await fetch(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: title, artist_name: artist })}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return pickLyrics((await res.json()) as Hit[], title, artist);
  } catch {
    return null;
  }
}
