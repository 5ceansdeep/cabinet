/* ponytail: 가짜 보관 기록 — 백엔드(저장 API)와 5.1 기록이 생기면 서랍·트랙을 거기서 받아온다.
   서랍 하나 = 감정 테마 태그 하나. 그 안에 건져 올린 곡들이 꽂혀 있다 */

import { TRACKS, type Track } from "@/components/results/tracks";

export type Shelf = { tag: string; kept: Track[] };

export const SHELVES: Shelf[] = [
  { tag: "#LATE-NIGHT", kept: TRACKS.slice(0, 3) },
  { tag: "#DREAMY", kept: TRACKS.slice(2, 5) },
  { tag: "#2026", kept: TRACKS.slice(1, 6) },
];
