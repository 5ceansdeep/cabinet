/* iTunes Search API — 앨범 커버와 30초 미리듣기. 키가 필요 없고, 결과는 DB 에 담아 두고 다시 부르지 않는다.
   ponytail: country=kr 에서 0건이 나오는 망이 있어 us 로 한 번 더 찾는다 */

export type ITunesInfo = { artwork: string; previewUrl: string | null; title: string; artist: string; genre: string | null };

type Result = { trackName: string; artistName: string; artistId?: number; artworkUrl100?: string; previewUrl?: string; primaryGenreName?: string };

// 비교용 — 대소문자·공백·괄호·기호를 떼고 본다 ("검정치마 (The Black Skirts)" ↔ "검정치마")
const norm = (s: string) => s.toLowerCase().replace(/[\s()[\]{}'".,!?&:;/\\_-]+/g, '');
const same = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};

async function get<T>(params: Record<string, string>): Promise<T[]> {
  const url = `https://itunes.apple.com/search?${new URLSearchParams({ media: 'music', limit: '5', ...params })}`;
  // 망이 막히거나 느려도 수집 요청 전체가 터지지 않게 — 못 찾은 것으로 친다
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: T[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

/* 가수 번호 — 미국 스토어는 가수 이름을 영문으로("검정치마" → "The Black Skirts"), 제목도 영어로 번역해 준다.
   글자로는 같은 가수인지 알 수 없으니, 가수를 따로 검색해 iTunes 가수 번호로 맞춘다 */
const artistIds = new Map<string, number | null>();
async function artistId(artist: string, country: string) {
  const key = `${country}|${artist}`;
  if (!artistIds.has(key)) {
    const [hit] = await get<{ artistId: number }>({ term: artist, entity: 'musicArtist', limit: '1', country });
    artistIds.set(key, hit?.artistId ?? null);
  }
  return artistIds.get(key) ?? null;
}

/* 검색 결과 다섯 개 중 그 가수의 곡만 쓴다 — 첫 번째를 그냥 쓰면 같은 제목의 다른 가수 곡이나 커버곡 표지가 붙는다
   (실제로 "선우정아 도망가자" 의 첫 결과는 MC몽 "Run Away" 였다). 가수는 번호로, 번호가 없으면 이름으로 맞춘다.
   그 가수의 곡 중 제목까지 맞는 게 있으면 그걸, 없으면(번역된 제목) 검색 순위가 가장 높은 것.
   그 가수의 곡이 하나도 없으면 null — 엉뚱한 표지보다 빈 표지가 낫다 */
export function pick(results: Result[], title: string, artist: string, id: number | null = null): Result | null {
  const byArtist = results.filter((r) => (id !== null && r.artistId === id) || same(r.artistName, artist));
  return byArtist.find((r) => same(r.trackName, title)) ?? byArtist[0] ?? null;
}

async function inStore(title: string, artist: string, country: string) {
  const songs = await get<Result>({ term: `${artist} ${title}`, entity: 'song', country });
  if (!songs.length) return null;
  return pick(songs, title, artist, await artistId(artist, country));
}

export async function findOnITunes(title: string, artist: string): Promise<ITunesInfo | null> {
  const hit = (await inStore(title, artist, 'kr')) ?? (await inStore(title, artist, 'us'));
  if (!hit?.artworkUrl100) return null;
  return {
    // 100x100 주소를 600x600 으로 바꿔 쓴다 — 디스크 라벨에 인쇄할 만한 크기
    artwork: hit.artworkUrl100.replace('100x100bb', '600x600bb'),
    previewUrl: hit.previewUrl ?? null,
    title: hit.trackName,
    artist: hit.artistName,
    genre: hit.primaryGenreName ?? null, // Last.fm 태그가 없을 때 대신 쓴다 (genres.ts)
  };
}
