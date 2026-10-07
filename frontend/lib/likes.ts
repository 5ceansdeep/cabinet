import { useSyncExternalStore } from "react";
import { api, getToken, logEvent } from "./api";

/* 좋아요한 곡 — 로그인한 사람만. 서버(/likes)가 원본이고, 화면은 누르는 즉시 바꾼 뒤 서버에 알린다(실패하면 되돌린다).
   서버는 이 기록으로 그 사람 추천을 조금 기울인다(backend recommend/score.ts tasteBonus) */
let ids = new Set<string>();
let owner: string | null = null; // 이 목록을 받아 온 출입증 — 다른 사람으로 들어오면 다시 받는다
const subs = new Set<() => void>();
const NONE = new Set<string>();

function set(next: Set<string>) {
  ids = next;
  subs.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  subs.add(cb);
  const token = getToken();
  if (token && token !== owner) {
    owner = token;
    ids = new Set();
    void api<string[]>("/likes").then((r) => r.ok && set(new Set([...ids, ...r.data])));
  }
  return () => void subs.delete(cb);
}

export const useLikes = () => useSyncExternalStore(subscribe, () => ids, () => NONE);
/** 좋아요를 누를 수 있나 — 로그인했을 때만(서버 없이 도는 가짜 곡 화면엔 하트가 없다) */
export const canLike = () => !!getToken();

export function toggleLike(trackId: string, query?: string) {
  const on = !ids.has(trackId);
  const flip = (to: boolean) => {
    const next = new Set(ids);
    if (to) next.add(trackId);
    else next.delete(trackId);
    set(next);
  };
  flip(on);
  if (on) logEvent("like", { trackId, query }); // 어떤 편지에서 어떤 곡이 좋았나(사용자 없이) — 평가 세트 재료
  void api("/likes", { method: "POST", body: { trackId, on } }).then((r) => !r.ok && flip(!on));
}
