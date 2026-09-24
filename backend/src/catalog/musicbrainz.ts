/* MusicBrainz — 곡에 붙어 있는 유튜브 링크를 찾는다. 키는 필요 없지만 앱 이름·연락처(User-Agent)를 보내야 하고
   초당 1회를 넘기면 안 된다. 유튜브 검색 API(100 단위)를 아끼려고 여기서 먼저 찾는다 */

const BASE = 'https://musicbrainz.org/ws/2';
let lastCall = 0;

async function get(path: string) {
  const wait = 1100 - (Date.now() - lastCall); // 초당 1회
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': process.env.MUSICBRAINZ_UA ?? 'cabinet/0.1 ( dev@example.com )' },
  });
  if (!res.ok) return null;
  return res.json();
}

const VIDEO_ID = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;

export async function findYoutubeId(title: string, artist: string): Promise<string | null> {
  const query = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
  const found = (await get(`/recording?query=${query}&fmt=json&limit=3`)) as { recordings?: { id: string }[] } | null;
  for (const rec of found?.recordings?.slice(0, 2) ?? []) {
    const detail = (await get(`/recording/${rec.id}?inc=url-rels&fmt=json`)) as
      | { relations?: { url?: { resource?: string } }[] }
      | null;
    for (const rel of detail?.relations ?? []) {
      const m = rel.url?.resource?.match(VIDEO_ID);
      if (m) return m[1];
    }
  }
  return null;
}
