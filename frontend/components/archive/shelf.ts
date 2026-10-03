/* 보관 기록 — 서랍 하나 = 감정 테마 태그 하나. 그 안에 건져 올린 곡들이 꽂혀 있다.
   로그인했으면 백엔드 /shelves 가 원본이고, 이 브라우저 localStorage 는 화면용 사본이다(없으면 사본이 전부).
   저장한 서랍은 아래 예시 서랍보다 앞에 놓는다 */

import { api, getToken, logEvent } from "@/lib/api";
import { TRACKS, type Track } from "@/components/results/tracks";

export type Shelf = { id: string; tag: string; query: string; kept: Track[]; keywords?: string[]; remote?: boolean }; // remote = 서버에 있는 서랍, keywords = 그때 요청 해석(공유 카드 MOOD)

const KEY = "cabinet.shelves";
const EVENT = "cabinet-shelves"; // 같은 탭 안에서 바뀐 걸 알린다 (storage 이벤트는 다른 탭에만 온다)
// ids 는 예전 형식(가짜 곡 번호) — 읽을 때만 받아 준다
type Saved = { id: string; tag: string; query?: string; keywords?: string[]; tracks?: Track[]; ids?: (number | string)[]; at: number; remote?: boolean };

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

type Remote = {
  id: string;
  tag: string;
  query: string;
  keywords?: string[];
  createdAt: string;
  tracks: { id: string; title: string; artist: string; artwork: string | null; previewUrl: string | null; description?: string | null; semantic?: number | null }[];
};
const fromRemote = (s: Remote, scores?: Track[]): Saved => ({
  id: s.id,
  remote: true,
  tag: s.tag,
  query: s.query,
  keywords: s.keywords ?? [],
  at: Date.parse(s.createdAt),
  // 일치도는 서버가 10/2 부터 서랍에 저장한다 — 그 전 서랍이면 화면에 있던 점수를 이어받는다
  tracks: s.tracks.map((t) => {
    const had = scores?.find((k) => k.title === t.title && k.artist === t.artist);
    return { cover: had?.cover ?? TRACKS[0].cover, ...had, ...t, semantic: t.semantic ?? had?.semantic ?? 0 };
  }),
});

/* 서랍에 넣는다 — 로그인했으면 서버에, 아니면 이 브라우저에만. 새 서랍 id 와 서버 서랍인지(공유 링크 /s/:id 가 되나)를 돌려준다 */
export async function saveShelf(tag: string, query: string, kept: Track[], keywords: string[] = []) {
  if (getToken()) {
    const r = await api<Remote>("/shelves", {
      method: "POST",
      body: {
        tag,
        query,
        keywords: keywords.slice(0, 8),
        tracks: kept.map((t) => ({ title: t.title, artist: t.artist, artwork: t.artwork ?? undefined, previewUrl: t.previewUrl ?? undefined, semantic: t.semantic || undefined })),
      },
    });
    if (r.ok) {
      write([fromRemote(r.data, kept), ...read().filter((x) => x.id !== r.data.id)]); // 같은 서랍을 또 넣으면 서버가 그 서랍을 돌려준다 — 사본도 하나만
      logEvent("save", { shelfId: r.data.id });
      return { id: r.data.id, remote: true };
    }
  }
  const shelf: Saved = { id: `s${Date.now().toString(36)}`, tag, query, keywords, tracks: kept, at: Date.now() };
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

export const TAG_MAX = 16; // 네임택 글자 수

/* 서랍 이름 제안 — 편지 글 그대로(10/3 사용자: #RAINY 같은 분류 대신 편지 내용으로). 네임택에 들어갈 만큼만 자르고,
   사용자가 네임택 위에서 고쳐 쓸 수 있다. 편지가 비었으면 날짜 */
export function suggestTag(query: string) {
  const letter = query.replace(/\s+/g, " ").trim();
  if (letter) {
    // 글자 단위로 자르되 서버(@MaxLength 16)는 UTF-16 으로 세니 이모지가 섞이면 한 글자씩 더 뺀다
    let tag = [...letter].slice(0, TAG_MAX);
    while (tag.join("").length > TAG_MAX) tag = tag.slice(0, -1);
    return tag.join("").trim();
  }
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
      keywords: s.keywords ?? [],
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
