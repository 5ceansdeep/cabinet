"use client";

import type { Track } from "./tracks";

/* 던져진 디스크를 3D 장면(CabinetWall 의 Canvas)으로 넘기는 통로.
   DOM 캐러셀에서 손을 떠나는 순간을 여기로 보내면, 장면 안에서 진짜 3D 플로피가 날아간다. */

export type Toss = {
  track: Track;
  ndc: [number, number]; // 손을 떠난 화면 위치 (-1..1)
  vx: number; // 화면 기준 초속 (px/s) — 장면에서 월드 단위로 바꾼다
  vy: number;
  onLanded: () => void; // 바닥에 멎어 사라지면
};

const listeners = new Set<(t: Toss) => void>();

export function tossDisk(t: Toss) {
  listeners.forEach((cb) => cb(t));
}

export function onToss(cb: (t: Toss) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// 앨범 커버(CSS 그라디언트 문자열)에서 색 두 개만 꺼낸다 — 3D 라벨에 그대로 칠한다
export function coverColors(cover: string): [string, string] {
  const hex = cover.match(/#[0-9a-f]{3,8}/gi) ?? [];
  return [hex[0] ?? "#8ec5fc", hex[1] ?? hex[0] ?? "#1e3a5f"];
}
