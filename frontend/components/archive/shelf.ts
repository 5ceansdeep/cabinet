/* 보관 기록 — 서랍 하나 = 감정 테마 태그 하나. 그 안에 건져 올린 곡들이 꽂혀 있다.
   로그인했으면 백엔드 /shelves 가 원본이고, 이 브라우저 localStorage 는 화면용 사본이다(없으면 사본이 전부).
   저장한 서랍은 아래 예시 서랍보다 앞에 놓는다 */

import { api, getToken, logEvent } from "@/lib/api";
import { TRACKS, type Track } from "@/components/results/tracks";

export type Shelf = { id: string; tag: string; query: string; kept: Track[]; remote?: boolean }; // remote = 서버에 있는 서랍

const KEY = "cabinet.shelves";
const EVENT = "cabinet-shelves"; // 같은 탭 안에서 바뀐 걸 알린다 (storage 이벤트는 다른 탭에만 온다)
// ids 는 예전 형식(가짜 곡 번호) — 읽을 때만 받아 준다
type Saved = { id: string; tag: string; query?: string; tracks?: Track[]; ids?: (number | string)[]; at: number; remote?: boolean };

function read(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function write(list: Saved[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  dispatchEvent(new Event(EVENT));
}

type Remote = { id: string; tag: string; query: string; createdAt: string; tracks: { id: string; title: string; artist: string; artwork: string | null; previewUrl: string | null }[] };
const fromRemote = (s: Remote, scores?: Track[]): Saved => ({
  id: s.id,
  remote: true,
  tag: s.tag,
  query: s.query,
  at: Date.parse(s.createdAt),
  // 서버는 점수를 모른다 — 방금 저장한 곡이면 화면에 있던 점수를 그대로 둔다
  tracks: s.tracks.map((t) => {
    const had = scores?.find((k) => k.title === t.title && k.artist === t.artist);
    return { semantic: 0, cover: had?.cover ?? TRACKS[0].cover, ...had, ...t };
  }),
});

/* 서랍에 넣는다 — 로그인했으면 서버에, 아니면 이 브라우저에만. 새 서랍 id 와 서버 서랍인지(공유 링크 /s/:id 가 되나)를 돌려준다 */
export async function saveShelf(tag: string, query: string, kept: Track[]) {
  if (getToken()) {
    const r = await api<Remote>("/shelves", {
      method: "POST",
      body: { tag, query, tracks: kept.map((t) => ({ title: t.title, artist: t.artist, artwork: t.artwork ?? undefined, previewUrl: t.previewUrl ?? undefined })) },
    });
    if (r.ok) {
      write([fromRemote(r.data, kept), ...read()]);
      logEvent("save", { shelfId: r.data.id });
      return { id: r.data.id, remote: true };
    }
  }
  const shelf: Saved = { id: `s${Date.now().toString(36)}`, tag, query, tracks: kept, at: Date.now() };
  write([shelf, ...read()]);
  logEvent("save", { shelfId: shelf.id });
  return { id: shelf.id, remote: false };
}

/* 서버 원본으로 사본을 새로 고친다 — 보관소에 들어올 때. 방금 저장한 곡의 점수는 사본에서 이어받는다 */
export async function syncShelves() {
  if (!getToken()) return;
  const r = await api<Remote[]>("/shelves");
  if (!r.ok) return;
  const local = read();
  write(r.data.map((s) => fromRemote(s, local.find((l) => l.id === s.id)?.tracks)));
}

/* 요청문에서 서랍 이름을 지어 준다 — 사용자가 네임택 위에서 고쳐 쓸 수 있게 제안만 한다.
   한 글자 낱말(비·눈·밤)은 다른 낱말 속에도 들어 있어(비밀·비행기, 눈물·눈치, 밤새) 뒤에 붙는 말까지 같이 본다 */
const HINTS: [RegExp, string][] = [
  [/새벽|심야|자정|밤(에|이|늦|길|하늘|공기|$|\s)/, "#LATE-NIGHT"],
  [/비(가|는|오|내리|올|온|맞|젖|소리|$|\s)|빗소리|빗길|장마|소나기|우산/, "#RAINY"],
  [/몽환|꿈|아련/, "#DREAMY"],
  [/신나|달리|드라이브|들뜬/, "#DRIVE"],
  [/우울|슬프|눈물|외로/, "#BLUE"],
  [/공부|집중|일할/, "#FOCUS"],
  [/겨울|추운|첫눈|눈(이|오|내리|사람|길|송이|$|\s)/, "#WINTER"],
  [/여름|바다|더운/, "#SUMMER"],
];

export function suggestTag(query: string) {
  const hit = HINTS.find(([re]) => re.test(query));
  if (hit) return hit[1];
  const d = new Date();
  return `#${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* 화면에서 읽을 때 — 사본을 구독해 저장 즉시 반영한다 (SSR 에선 빈 문자열) */
export const shelvesRaw = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
export function subscribeShelves(cb: () => void) {
  addEventListener("storage", cb);
  addEventListener(EVENT, cb);
  return () => {
    removeEventListener("storage", cb);
    removeEventListener(EVENT, cb);
  };
}
// 저장해 둔 서랍(최신이 앞) + 예시 서랍
export function parseShelves(raw: string): Shelf[] {
  let saved: Saved[] = [];
  try {
    saved = raw ? JSON.parse(raw) : [];
  } catch {}
  const mine = saved
    .sort((a, b) => b.at - a.at)
    .map((s) => ({
      id: s.id,
      tag: s.tag,
      query: s.query ?? "",
      remote: s.remote,
      kept: s.tracks ?? (s.ids ?? []).map((id) => TRACKS.find((t) => t.id === String(id))).filter((t): t is Track => !!t),
    }));
  return mine; // 견본 서랍(가짜 곡)은 10/2 뺐다 — 빈 칸은 ArchiveRoom 이 빈 서랍으로 그린다
}

/* 유튜브에서 이어 듣기 — 서버 서랍이면 영상을 찾아 watch_videos 링크를, 아니면 곡별 검색 링크만(할당량 0) */
export type Playlist = {
  url: string | null;
  exhausted: boolean;
  missing: { title: string; artist: string; search: string }[];
  local?: boolean;
};
const searchUrl = (t: { title: string; artist: string }) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t.artist} ${t.title}`)}`;

export async function playlistOf(shelf: Shelf): Promise<Playlist | null> {
  if (shelf.remote && getToken()) {
    const r = await api<Playlist>(`/shelves/${shelf.id}/playlist`, { method: "POST" });
    return r.ok ? r.data : null;
  }
  return { url: null, exhausted: false, local: true, missing: shelf.kept.map((t) => ({ title: t.title, artist: t.artist, search: searchUrl(t) })) };
}
