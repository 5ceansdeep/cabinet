/* iTunes Search API — 앨범 커버와 30초 미리듣기. 키가 필요 없고, 결과는 DB 에 담아 두고 다시 부르지 않는다.
   ponytail: country=kr 에서 0건이 나오는 망이 있어 us 로 한 번 더 찾는다 */

export type ITunesInfo = { artwork: string; previewUrl: string | null; title: string; artist: string };

type Result = { trackName: string; artistName: string; artworkUrl100?: string; previewUrl?: string };

async function search(term: string, country: string): Promise<Result | null> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5&country=${country}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: Result[] };
  return json.results?.[0] ?? null;
}

export async function findOnITunes(title: string, artist: string): Promise<ITunesInfo | null> {
  const term = `${artist} ${title}`;
  const hit = (await search(term, 'kr')) ?? (await search(term, 'us'));
  if (!hit) return null;
  return {
    // 100x100 주소를 600x600 으로 바꿔 쓴다 — 디스크 라벨에 인쇄할 만한 크기
    artwork: (hit.artworkUrl100 ?? '').replace('100x100bb', '600x600bb'),
    previewUrl: hit.previewUrl ?? null,
    title: hit.trackName,
    artist: hit.artistName,
  };
}
