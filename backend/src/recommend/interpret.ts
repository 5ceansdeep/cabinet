import type { Tags } from '../catalog/lastfm.js';

/* 요청문 → Last.fm 태그 가중치. 한국 곡은 Last.fm 에 분위기 태그가 드물어서 어울리는 장르 태그도 같이 싣는다.
   화면에는 "요청 해석"으로 그대로 보여 준다.
   ponytail: 한국어 낱말 사전 — docs/ai-report-plan.md 의 LLM 해석(온도 0·해시 캐시)이 붙으면 이 함수 몸통만 바꾼다 */

const WORDS: [RegExp, Tags][] = [
  [/새벽|밤|심야|자정|잠\s?안/, { night: 100, chill: 60, mellow: 50, indie: 50, 'r&b': 40, 'indie pop': 30 }],
  [/비|빗소리|장마|흐린/, { melancholy: 80, mellow: 60, acoustic: 40, ballad: 50, 'r&b': 30, soul: 30 }],
  [/몽환|꿈|아련|흐릿/, { dreamy: 100, 'dream pop': 80, shoegaze: 50, atmospheric: 50, psychedelic: 40, 'indie pop': 40 }],
  [/신나|달리|드라이브|들뜬|설레/, { upbeat: 100, energetic: 80, happy: 50, pop: 50, dance: 50, disco: 40, rock: 30 }],
  [/우울|슬프|눈물|외로|이별|헤어/, { sad: 100, melancholy: 80, emotional: 60, ballad: 70, 'female vocalists': 20 }],
  [/공부|집중|일할|작업/, { instrumental: 80, 'lo-fi': 80, chill: 60, ambient: 50 }],
  [/겨울|눈\s|추운/, { winter: 100, mellow: 50, acoustic: 40 }],
  [/여름|바다|더운|휴가/, { summer: 100, happy: 50, upbeat: 40 }],
  [/사랑|설렘|연애|고백/, { love: 100, romantic: 80, beautiful: 40, ballad: 50, 'r&b': 40, soul: 30 }],
  [/파티|춤|클럽/, { dance: 100, party: 80, electronic: 50 }],
  [/화나|분노|스트레스/, { aggressive: 80, rock: 60, energetic: 50 }],
  [/잔잔|편안|쉬고|휴식|힐링/, { chill: 100, mellow: 80, acoustic: 50, 'r&b': 40, soul: 40, 'singer-songwriter': 30 }],
  [/옛날|추억|그리운|향수/, { nostalgic: 100, retro: 60, '90s': 40, 'indie rock': 30, ballad: 30 }],
  [/인디/, { indie: 100, 'indie rock': 50, 'indie pop': 50 }],
  [/록|락|밴드/, { rock: 100, 'indie rock': 50, 'alt-rock': 50 }],
  [/재즈/, { jazz: 100 }],
  [/힙합|랩/, { 'hip-hop': 100, rap: 80, 'k-hiphop': 80 }],
  [/케이팝|아이돌/, { 'k-pop': 100 }],
];

// 아무 낱말도 안 걸리면 — 넓게 한국 인디 쪽을 뒤진다
const FALLBACK: Tags = { korean: 60, indie: 60, mellow: 30 };

export function interpret(query: string): Tags {
  const out: Tags = {};
  for (const [re, tags] of WORDS) {
    if (!re.test(query)) continue;
    for (const [t, w] of Object.entries(tags)) out[t] = Math.max(out[t] ?? 0, w);
  }
  return Object.keys(out).length ? out : { ...FALLBACK };
}

