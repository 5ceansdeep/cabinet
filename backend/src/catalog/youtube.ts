/* 유튜브 검색 폴백 — MusicBrainz 에서 못 찾은 곡만. search.list 는 한 번에 100 단위(하루 10,000)라
   반드시 캐시(Track.videoId)와 하루 상한을 함께 쓴다. 키가 없으면 그냥 건너뛴다 (키: Google Cloud Console → YouTube Data API v3) */

const DAILY_LIMIT = Number(process.env.YT_SEARCH_DAILY_LIMIT ?? 60); // 60회 = 6,000 단위
let used = 0;
let day = new Date().toDateString();

export const searchBudget = () => {
  if (day !== new Date().toDateString()) {
    day = new Date().toDateString();
    used = 0;
  }
  return { used, left: Math.max(0, DAILY_LIMIT - used) };
};

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
  used++;
  if (!res.ok) return null;
  const json = (await res.json()) as { items?: Item[] };
  const items = json.items ?? [];
  // 공식 음원(아티스트 - Topic 채널)을 먼저, 없으면 첫 결과
  const official = items.find((i) => /- Topic$/.test(i.snippet.channelTitle) || i.snippet.channelTitle.includes(artist));
  return (official ?? items[0])?.id.videoId ?? null;
}
