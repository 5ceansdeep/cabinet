import { CABINET } from "@/components/landing/dimensions";

/* 결과 방 치수 — 둘러선 벽(CabinetWall)과 디스크(Deck)가 같이 쓴다. 둘이 서로를 불러오면 순환이라 여기 따로 둔다 */

const { W, H, GAP } = CABINET;
export const RADIUS = 6.5; // 카메라에서 벽까지 (월드 단위) — 멀찍이 서서 본다
// 기둥 하나가 차지하는 호(2πR/COLUMNS)가 서류함 폭(W)과 같아야 틈 없이 둘러선다
export const COLUMNS = Math.round((2 * Math.PI * RADIUS) / W); // 빙 둘러선 서류함 수
export const ROWS = 13; // 한 줄의 서랍 수 — 화면 위아래로 한참 넘치게(끝이 어둠에 묻히도록)
export const rowY = (r: number) => (r - (ROWS - 1) / 2) * (H + GAP);

/* 결과 서랍 — 곡이 오면 정면 한 칸 아래 서랍이 몸통째 쭉 빠지고, 디스크들이 그 입구에서 솟아오른다 */
export const REVEAL = { col: 0, row: 5, out: 0.45, hold: 1.1, back: 0.5, depth: 1.7 }; // 초, 빠지는 거리
export const REVEAL_MOUTH: [number, number, number] = [0, rowY(REVEAL.row), -RADIUS + REVEAL.depth];
export const REVEAL_LEAD = REVEAL.out * 0.8; // 서랍이 이만큼 빠진 뒤 디스크가 나온다(초)
