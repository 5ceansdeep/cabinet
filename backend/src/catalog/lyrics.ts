import { same, usName } from './itunes.js';

/* 가사 — LRCLIB(키 없음). 곡 설명을 만드는 데만 쓰고 저장·화면 표시는 하지 않는다(저작권).
   LRCLIB 은 한국 곡을 영문 이름(IU - Through the Night)으로 갖고 있어, 한글 이름으로 못 찾으면 iTunes 미국 스토어 표기로 한 번 더.
   결과는 셋 — 가사 / 연주곡(LRCLIB 이 instrumental 로 기록) / 못 찾음(null). 못 찾음 ≠ 연주곡(9/30 "가사 없는 연주곡" 거짓말).
   망 실패는 던진다 — 못 찾음으로 치면 가사 있는 곡이 가사 없이 설명된다(Oasis - Supersonic).
   ponytail: 같은 제목 다른 곡은 가수·제목이 둘 다 맞는지로만 거른다 — 곡 길이 비교는 Track 에 길이가 없어 못 한다 */

type Hit = { trackName: string; artistName: string; instrumental: boolean; plainLyrics: string | null };
export type Lyrics = { text: string | null; instrumental: boolean } | null;

/** 가수·제목이 맞는 결과 중 가사가 있으면 가사, 연주곡 기록만 있으면 연주곡, 맞는 결과가 없으면 null */
export function pickLyrics(hits: Hit[], title: string, artist: string): Lyrics {
  const mine = hits.filter((h) => same(h.artistName, artist) && same(h.trackName, title));
  const text = mine.find((h) => !h.instrumental && h.plainLyrics?.trim())?.plainLyrics?.trim();
  if (text) return { text, instrumental: false };
  return mine.some((h) => h.instrumental) ? { text: null, instrumental: true } : null;
}

async function search(title: string, artist: string): Promise<Lyrics> {
  const q = (s: string) => s.replace(/[‘’]/g, "'");
  const res = await fetch(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: q(title), artist_name: q(artist) })}`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
  return pickLyrics((await res.json()) as Hit[], title, artist);
}

export async function findLyrics(title: string, artist: string): Promise<Lyrics> {
  const found = await search(title, artist);
  if (found) return found;
  const us = await usName(title, artist);
  return us && (us.title !== title || us.artist !== artist) ? search(us.title, us.artist) : null;
}
