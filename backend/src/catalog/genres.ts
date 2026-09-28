import type { Tags } from './lastfm.js';

/* iTunes 장르 → Last.fm 태그 — Last.fm 에 곡·가수 태그가 하나도 없을 때만 쓰는 마지막 수단 (DRIFT song-vector 의 ITUNES_GENRE_MAP).
   ponytail: 거칠다. 미국 스토어는 한국 곡을 거의 다 "K-Pop" 하나로 묶어(발라드·인디·힙합 구분 없음) 이 곡들끼리는 점수가 같다.
   이 태그만 가진 곡이 추천에서 뭉치면 LLM 태깅(가사 참고, CONTEXT "곡 특징 보강")으로 바꾼다 */

const MAP: Record<string, string[]> = {
  'k-pop': ['k-pop', 'korean'],
  'korean pop': ['k-pop', 'korean'],
  가요: ['k-pop', 'korean'],
  'j-pop': ['j-pop', 'japanese'],
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

export function genreTags(genre: string | null | undefined): Tags {
  const tags = MAP[(genre ?? '').toLowerCase().trim()] ?? [];
  return Object.fromEntries(tags.map((t) => [t, 100]));
}
