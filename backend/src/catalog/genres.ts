import type { Tags } from './lastfm.js';

/* iTunes 장르 → Last.fm 태그 — Last.fm 에 곡·가수 태그가 하나도 없을 때만 쓰는 마지막 수단 (DRIFT song-vector 의 ITUNES_GENRE_MAP).
   ponytail: 거칠다. 미국 스토어는 한국 곡을 거의 다 "K-Pop" 하나로 묶어(발라드·인디·힙합 구분 없음) 이 곡들끼리는 점수가 같다.
   이 태그만 가진 곡이 추천에서 뭉치면 LLM 태깅(가사 참고, CONTEXT "곡 특징 보강")으로 바꾼다 */

const MAP: Record<string, string[]> = {
  'k-pop': ['k-pop', 'korean'],
  'korean pop': ['k-pop', 'korean'],
  가요: ['k-pop', 'korean'],
  'j-pop': ['j-pop', 'japanese'],
  anime: ['j-pop', 'japanese'],
  'french pop': ['chanson', 'french'],
  chanson: ['chanson', 'french'],
  house: ['house', 'electronic'],
  'vocal jazz': ['jazz'],
  pop: ['pop'],
  rock: ['rock'],
  록: ['rock', 'korean'],
  alternative: ['alternative'],
  'alternative & punk': ['alternative', 'punk'],
  'hip-hop/rap': ['hip-hop', 'rap'],
  'hip-hop': ['hip-hop', 'rap'],
  '랩/힙합': ['hip-hop', 'rap', 'korean'],
  electronic: ['electronic'],
  'electronica/dance': ['electronic', 'dance'],
  dance: ['dance'],
  댄스: ['dance', 'korean'],
  jazz: ['jazz'],
  재즈: ['jazz'],
  classical: ['classical'],
  metal: ['metal'],
  punk: ['punk'],
  folk: ['folk'],
  포크: ['folk', 'korean'],
  country: ['country'],
  blues: ['blues'],
  'r&b/soul': ['r&b', 'soul'],
  'r&b': ['r&b'],
  soul: ['soul'],
  reggae: ['reggae'],
  funk: ['funk'],
  'indie pop': ['indie pop', 'indie'],
  'indie rock': ['indie rock', 'indie'],
  인디: ['indie', 'korean'],
  발라드: ['ballad', 'korean'],
  ballad: ['ballad'],
  'singer/songwriter': ['singer-songwriter'],
  soundtrack: ['soundtrack'],
  ost: ['soundtrack'],
  latin: ['latin'],
  ambient: ['ambient'],
  'easy listening': ['chill', 'mellow'],
  instrumental: ['instrumental'],
  acoustic: ['acoustic'],
};

/* 편지지에서 고르는 장르 — 키 → 곡 태그(Last.fm·iTunes 장르). 겹치는 장르는 하나로 묶었다(9/30 사용자:
   인디 팝·인디 록·k-indie → 인디, 하우스·EDM·디스코 → 하우스·일렉트로닉, 랩·k-hiphop → 힙합 등).
   화면 이름은 frontend/lib/genres.ts — 키를 바꾸면 둘 다 */
export const GENRES: Record<string, string[]> = {
  kpop: ['k-pop', 'kpop', 'girl group', 'boy band', 'girlband'],
  pop: ['pop', 'dance pop', 'electropop', 'synth-pop', 'synthpop', 'teen pop'],
  indie: ['indie', 'k-indie', 'korean indie', 'k indie', 'indie pop', 'indie folk'],
  rock: ['rock', 'k-rock', 'indie rock', 'alternative', 'alt-rock', 'alternative rock', 'britpop', 'modern rock', 'shoegaze', 'post-rock', 'soft rock', 'punk', 'korean band'],
  ballad: ['ballad', 'korean ballad', 'acoustic', 'singer-songwriter', 'folk'],
  rnb: ['r&b', 'rnb', 'soul', 'korean rnb', 'neo-soul'],
  hiphop: ['hip-hop', 'hip hop', 'hiphop', 'rap', 'k-hiphop', 'korean hip-hop', 'trap'],
  house: ['house', 'deep house', 'french house', 'electronic', 'electronica', 'edm', 'dance', 'disco', 'techno', 'baltimore club'],
  jazz: ['jazz', 'vocal jazz', 'jazz pop', 'smooth jazz', 'bossa nova'],
  jpop: ['j-pop', 'jpop', 'japanese', 'city pop', 'j-rock', 'anime'],
  chanson: ['chanson', 'french', 'french pop', 'chanson francaise'],
};
const MIN_WEIGHT = 10; // Last.fm 태그 가중치 0~100 — 이보다 약한 태그는 우연히 붙은 것

/** 곡 태그가 고른 장르 중 하나에 드나. 장르를 안 골랐으면 늘 참 */
export function inGenres(tags: Tags, keys: string[]): boolean {
  if (!keys.length) return true;
  const want = new Set(keys.flatMap((k) => GENRES[k] ?? []));
  return Object.entries(tags).some(([t, w]) => w >= MIN_WEIGHT && want.has(t.toLowerCase()));
}

export function genreTags(genre: string | null | undefined): Tags {
  const tags = MAP[(genre ?? '').toLowerCase().trim()] ?? [];
  return Object.fromEntries(tags.map((t) => [t, 100]));
}
