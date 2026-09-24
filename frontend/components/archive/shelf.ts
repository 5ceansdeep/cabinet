/* ponytail: 가짜 보관 기록 — 백엔드(저장 API)가 생기면 이 파일의 읽기/쓰기만 fetch 로 바꾸면 된다.
   서랍 하나 = 감정 테마 태그 하나. 그 안에 건져 올린 곡들이 꽂혀 있다.
   저장한 서랍은 이 브라우저 localStorage 에 두고, 아래 예시 서랍보다 앞에 놓는다 */

import { TRACKS, type Track } from "@/components/results/tracks";

export type Shelf = { id: string; tag: string; kept: Track[] };

const KEY = "cabinet.shelves";
type Saved = { id: string; tag: string; ids: number[]; at: number };

// 예시 서랍 — 아직 저장한 게 없어도 방이 비어 보이지 않게
const DEMO: Shelf[] = [
  { id: "demo-late", tag: "#LATE-NIGHT", kept: TRACKS.slice(0, 3) },
  { id: "demo-dreamy", tag: "#DREAMY", kept: TRACKS.slice(2, 5) },
  { id: "demo-2026", tag: "#2026", kept: TRACKS.slice(1, 6) },
];

function read(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function loadShelves(): Shelf[] {
  const saved = read()
    .sort((a, b) => b.at - a.at)
    .map((s) => ({ id: s.id, tag: s.tag, kept: s.ids.map((id) => TRACKS.find((t) => t.id === id)).filter((t): t is Track => !!t) }));
  return [...saved, ...DEMO];
}

export function saveShelf(tag: string, kept: Track[]) {
  const shelf: Saved = { id: `s${Date.now().toString(36)}`, tag, ids: kept.map((t) => t.id), at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify([shelf, ...read()]));
  } catch {}
  return shelf.id;
}

/* 요청문에서 서랍 이름을 지어 준다 — 사용자가 네임택 위에서 고쳐 쓸 수 있게 제안만 한다 */
const HINTS: [RegExp, string][] = [
  [/새벽|밤|심야|자정/, "#LATE-NIGHT"],
  [/비|빗소리|장마/, "#RAINY"],
  [/몽환|꿈|아련/, "#DREAMY"],
  [/신나|달리|드라이브|들뜬/, "#DRIVE"],
  [/우울|슬프|눈물|외로/, "#BLUE"],
  [/공부|집중|일할/, "#FOCUS"],
  [/겨울|눈|추운/, "#WINTER"],
  [/여름|바다|더운/, "#SUMMER"],
];

export function suggestTag(query: string) {
  const hit = HINTS.find(([re]) => re.test(query));
  if (hit) return hit[1];
  const d = new Date();
  return `#${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* 화면에서 읽을 때 — localStorage 를 구독해 저장 즉시 반영한다 (SSR 에선 빈 문자열) */
export const shelvesRaw = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
export function subscribeShelves(cb: () => void) {
  addEventListener("storage", cb);
  return () => removeEventListener("storage", cb);
}
export function parseShelves(raw: string): Shelf[] {
  let saved: Saved[] = [];
  try {
    saved = raw ? JSON.parse(raw) : [];
  } catch {}
  const mine = saved
    .sort((a, b) => b.at - a.at)
    .map((s) => ({ id: s.id, tag: s.tag, kept: s.ids.map((id) => TRACKS.find((t) => t.id === id)).filter((t): t is Track => !!t) }));
  return [...mine, ...DEMO];
}
