/* Last.fm 태그 — 곡이 어떤 곡인지 사람들이 붙인 이름표(장르·분위기·시대)와 그 무게(0~100).
   곡 태그가 없으면 가수 태그로 대신한다. 무료 키, 비상업·출처 표기 조건. (DRIFT song-vector.service 에서 옮겨 옴) */

export type Tags = Record<string, number>;

// Last.fm 태그 표기 차이를 하나로 모은다
const NORMALIZE: Record<string, string> = {
  kpop: 'k-pop',
  jpop: 'j-pop',
  hiphop: 'hip-hop',
  'hip hop': 'hip-hop',
  rnb: 'r&b',
  'r and b': 'r&b',
  'lo fi': 'lo-fi',
  lofi: 'lo-fi',
  'synth pop': 'synth-pop',
  synthpop: 'synth-pop',
  'alt rock': 'alt-rock',
  'alternative rock': 'alt-rock',
  'post punk': 'post-punk',
  'dream-pop': 'dream pop',
  'indie-rock': 'indie rock',
  'indie-pop': 'indie pop',
  'female vocals': 'female vocalists',
  'male vocals': 'male vocalists',
  'singer songwriter': 'singer-songwriter',
  electronica: 'electronic',
  chillout: 'chill',
  'chill out': 'chill',
  melancholic: 'melancholy',
  "80's": '80s',
  "90's": '90s',
};

type TopTags = { toptags?: { tag?: { name: string; count: number | string }[] } };

async function call<T>(params: Record<string, string>): Promise<T | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;
  const qs = new URLSearchParams({ ...params, api_key: key, format: 'json', autocorrect: '1' });
  try {
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${qs}`);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function topTags(params: Record<string, string>): Promise<Tags> {
  const r = await call<TopTags>(params);
  const out: Tags = {};
  for (const t of r?.toptags?.tag?.slice(0, 20) ?? []) {
    const raw = t.name.toLowerCase().trim();
    const name = NORMALIZE[raw] ?? raw;
    const w = Number(t.count);
    if (w > 0) out[name] = Math.max(out[name] ?? 0, w);
  }
  return out;
}

export async function fetchTags(title: string, artist: string): Promise<Tags> {
  const track = await topTags({ method: 'track.getTopTags', artist, track: title });
  if (Object.keys(track).length >= 3) return track;
  // 곡 태그가 모자라면 가수 태그로 채운다 — 곡 태그를 우선
  return { ...(await topTags({ method: 'artist.getTopTags', artist })), ...track };
}

/* ─ 곡 풀을 넓힐 후보 — 태그의 인기곡, 비슷한 가수의 인기곡 ─ */

export type Ref = { title: string; artist: string };

type TrackList = { name: string; artist: { name: string } }[];

/** page = 몇 번째 쪽(1 부터) — limit 20 에 page 3 이면 41~60위 */
export async function tagTopTracks(tag: string, limit = 30, page = 1): Promise<Ref[]> {
  const r = await call<{ tracks?: { track?: TrackList } }>({ method: 'tag.getTopTracks', tag, limit: String(limit), page: String(page) });
  return (r?.tracks?.track ?? []).map((t) => ({ title: t.name, artist: t.artist.name }));
}

export async function similarArtists(artist: string, limit = 5): Promise<string[]> {
  const r = await call<{ similarartists?: { artist?: { name: string }[] } }>({ method: 'artist.getSimilar', artist, limit: String(limit) });
  return (r?.similarartists?.artist ?? []).map((a) => a.name);
}

export async function similarTracks(title: string, artist: string, limit = 50): Promise<Ref[]> {
  const r = await call<{ similartracks?: { track?: TrackList } }>({ method: 'track.getSimilar', track: title, artist, limit: String(limit), autocorrect: '1' });
  return (r?.similartracks?.track ?? []).map((t) => ({ title: t.name, artist: t.artist.name }));
}

export async function artistTopTracks(artist: string, limit = 3): Promise<Ref[]> {
  const r = await call<{ toptracks?: { track?: TrackList } }>({ method: 'artist.getTopTracks', artist, limit: String(limit) });
  return (r?.toptracks?.track ?? []).map((t) => ({ title: t.name, artist: t.artist.name }));
}
