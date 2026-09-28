/* 유튜브 검색 — 곡의 영상 ID 를 찾는다. search.list 는 한 번에 100 단위(하루 10,000)라
   반드시 캐시(Track.videoId)와 하루 상한을 함께 쓴다. 키가 없으면 그냥 건너뛴다 (키: Google Cloud Console → YouTube Data API v3) */

import { readFileSync, writeFileSync } from 'node:fs';

const DAILY_LIMIT = Number(process.env.YT_SEARCH_DAILY_LIMIT ?? 60); // 60회 = 6,000 단위

/* 오늘 쓴 횟수는 파일에 적어 둔다 — 메모리에만 두면 개발 서버가 파일 저장마다 재시작하면서 0 으로 돌아가 상한이 안 먹는다.
   날짜는 태평양 시간으로 센다 — 유튜브 할당량이 그 자정에 풀린다.
   ponytail: 서버가 여러 대면 파일을 따로 가진다 — 그땐 DB 로 */
const FILE = '.yt-budget.json';
type Budget = { day: string; used: number };

export const PT = 'America/Los_Angeles';
const ptDay = () => new Date().toLocaleDateString('en-CA', { timeZone: PT });

function load(): Budget {
  const today = ptDay();
  try {
    const b = JSON.parse(readFileSync(FILE, 'utf8')) as Budget;
    if (b.day === today) return b;
  } catch {}
  return { day: today, used: 0 };
}

export const searchBudget = () => {
  const { used } = load();
  return { used, left: Math.max(0, DAILY_LIMIT - used) };
};

function spend() {
  const b = load();
  b.used++;
  try {
    writeFileSync(FILE, JSON.stringify(b));
  } catch {}
}

type Item = { id: { videoId: string }; snippet: { title: string; channelTitle: string } };

/** 영상 ID 찾기 — { id } 는 검색했다는 뜻(못 찾았으면 id: null), null 은 검색을 못 했다(키 없음·오늘 상한·오류) */
export async function searchVideoId(title: string, artist: string): Promise<{ id: string | null } | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || searchBudget().left <= 0) return null;

  const params = new URLSearchParams({
    part: 'snippet',
    q: `${artist} ${title}`,
    type: 'video',
    videoCategoryId: '10', // 음악
    maxResults: '5',
    key,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`).catch(() => null);
  if (!res) return null;
  spend();
  if (!res.ok) return null; // 403(할당량 초과·키 문제) 등 — 못 찾은 게 아니라 못 물어본 것
  const json = (await res.json()) as { items?: Item[] };
  return { id: pickVideo(json.items ?? [], title, artist) };
}

// 라이브·방송 무대·커버 — 곡 제목에 이미 들어 있지 않으면 음원 대신 걸린 것
const NOT_ORIGINAL = /live|라이브|스케치북|콘서트|concert|직캠|fancam|cover|커버|reaction|playlist|\d+\s?(시간|hour)/i;

/** 검색 결과 중 원곡 영상 — 공식 음원(Topic) > 가수 채널 > 첫 결과, 라이브·커버는 뺀다. 다 걸리면 null */
export function pickVideo(items: Item[], title: string, artist: string): string | null {
  const ok = NOT_ORIGINAL.test(title) ? items : items.filter((i) => !NOT_ORIGINAL.test(i.snippet.title));
  const a = artist.toLowerCase();
  const official =
    ok.find((i) => i.snippet.channelTitle.endsWith('- Topic')) ?? ok.find((i) => i.snippet.channelTitle.toLowerCase().includes(a));
  return (official ?? ok[0])?.id.videoId ?? null;
}
