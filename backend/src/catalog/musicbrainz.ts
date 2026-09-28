/* 가수 이름 통일 — iTunes 는 날에 따라 한국 스토어도 영문 이름을 줘서("아이유" → "I.U.") 같은 가수가 두 이름으로 쌓인다.
   MusicBrainz(키 없음, 초당 1회)에서 한국 가수로 확실히 잡히면 한글 이름으로 맞춘다. 못 찾으면 null — 원래 이름을 쓴다 */

type Alias = { name: string; locale?: string | null; type?: string | null; primary?: boolean | null };
export type MbArtist = { name: string; score: number; country?: string; aliases?: Alias[] };

const HANGUL = /[가-힣]/;

/** 한글 이름이면 그대로, 아니면 한국어 대표 별칭(IU → 아이유), 대표가 없으면 하나뿐인 한국어 예명(SE SO NEON → 새소년),
    그것도 없거나 여럿이면 MB 이름(10CM → 10cm, NewJeans — 뉴진스·엔제이지 둘). 본명(RM → 김남준)은 안 쓴다. 확실한 한국 가수가 아니면 null */
export function pickName(artists: MbArtist[]): string | null {
  const a = artists.find((x) => x.score === 100 && x.country === 'KR');
  if (!a) return null;
  if (HANGUL.test(a.name)) return a.name;
  const ko = a.aliases?.filter((x) => x.locale === 'ko' && HANGUL.test(x.name)) ?? [];
  const primary = ko.find((x) => x.primary);
  const stage = ko.filter((x) => x.type === 'Artist name');
  return primary?.name ?? (stage.length === 1 ? stage[0].name : a.name);
}

const cache = new Map<string, string | null>();
let last = 0;

export async function koreanName(artist: string, retry = true): Promise<string | null> {
  if (HANGUL.test(artist)) return artist; // 이미 한글이면 그대로 — MB 이름이 영문인 가수(에일리 → Ailee)로 도로 바뀌지 않게
  if (cache.has(artist)) return cache.get(artist)!;
  // ponytail: 초당 1회 제한을 프로세스 안에서만 지킨다 — 서버가 여러 대면 따로 센다
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const q = `artist:"${artist.replace(/"/g, '')}" OR alias:"${artist.replace(/"/g, '')}"`;
  try {
    const res = await fetch(`https://musicbrainz.org/ws/2/artist?fmt=json&limit=3&query=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'cabinet/0.1 (https://github.com/5ceansdeep/cabinet)' }, // MB 는 UA 없으면 막는다
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 503 && retry) return koreanName(artist, false); // 속도 제한 — 한 번만 다시
    if (!res.ok) return null; // 캐시하지 않고 다음에 다시 묻는다
    const name = pickName(((await res.json()) as { artists?: MbArtist[] }).artists ?? []);
    cache.set(artist, name);
    return name;
  } catch {
    return null;
  }
}
