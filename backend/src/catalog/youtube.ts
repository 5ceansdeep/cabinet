/* 유튜브 검색 폴백 — MusicBrainz 에서 못 찾은 곡만. search.list 는 한 번에 100 단위(하루 10,000)라
   반드시 캐시(Track.videoId)와 하루 상한을 함께 쓴다. 키가 없으면 그냥 건너뛴다 (키: Google Cloud Console → YouTube Data API v3) */

import { readFileSync, writeFileSync } from 'node:fs';

const DAILY_LIMIT = Number(process.env.YT_SEARCH_DAILY_LIMIT ?? 60); // 60회 = 6,000 단위

/* 오늘 쓴 횟수는 파일에 적어 둔다 — 메모리에만 두면 개발 서버가 파일 저장마다 재시작하면서 0 으로 돌아가 상한이 안 먹는다.
   ponytail: 서버가 여러 대면 파일을 따로 가진다 — 그땐 DB 로. 유튜브 할당량은 태평양 시간 자정에 풀리지만 여기선 서버 날짜로 센다 */
const FILE = '.yt-budget.json';
type Budget = { day: string; used: number };

function load(): Budget {
  const today = new Date().toDateString();
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

export async function searchVideoId(title: string, artist: string): Promise<string | null> {
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
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  spend();
  if (!res.ok) return null;
  const json = (await res.json()) as { items?: Item[] };
  const items = json.items ?? [];
  // 공식 음원(아티스트 - Topic 채널)을 먼저, 없으면 첫 결과
  const official = items.find((i) => /- Topic$/.test(i.snippet.channelTitle) || i.snippet.channelTitle.includes(artist));
  return (official ?? items[0])?.id.videoId ?? null;
}
