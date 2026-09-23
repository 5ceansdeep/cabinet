"use client";

import type { Track } from "./tracks";

/* 손을 떠난 디스크를 물리 담당(Flights)에게 넘기는 통로. 좌표는 전부 월드 단위 */

export type Toss = {
  track: Track;
  p: [number, number, number]; // 손을 떠난 자리
  v: [number, number, number]; // 그때의 속도
  onLanded: () => void; // 바닥에 멎으면
};

const listeners = new Set<(t: Toss) => void>();

export const tossDisk = (t: Toss) => listeners.forEach((cb) => cb(t));

export function onToss(cb: (t: Toss) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// 앨범 커버(CSS 그라디언트 문자열)에서 색 두 개만 꺼낸다 — 3D 라벨에 그대로 칠한다
export function coverColors(cover: string): [string, string] {
  const hex = cover.match(/#[0-9a-f]{3,8}/gi) ?? [];
  return [hex[0] ?? "#8ec5fc", hex[1] ?? hex[0] ?? "#1e3a5f"];
}
