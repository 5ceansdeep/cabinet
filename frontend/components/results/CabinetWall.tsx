"use client";

import { Canvas } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CABINET } from "@/components/landing/dimensions";
import { materials } from "@/components/landing/materials";
import Deck from "./Deck";
import Flights from "./Flights";
import SaveDrawer from "./SaveDrawer";
import type { Track } from "./tracks";

/* 4번 배경 — 랜딩과 같은 서류함(치수·재료 그대로)이 시야를 빙 둘러 서 있다.
   카메라는 그 한가운데. 어두운 안개에 잠겨 위아래·좌우 끝이 안 보인다.
   frameloop="demand" — 움직이지 않는 배경이라 첫 프레임만 그리고 논다 */

const { W, H, GAP, T } = CABINET;
// 기둥 하나가 차지하는 호(2πR/COLUMNS)가 서류함 폭(W)과 같아야 틈 없이 둘러선다
const RADIUS = 6.5; // 카메라에서 벽까지 (월드 단위) — 멀찍이 서서 본다
const COLUMNS = Math.round((2 * Math.PI * RADIUS) / W); // 빙 둘러선 서류함 수
const ROWS = 13; // 한 줄의 서랍 수 — 화면 위아래로 한참 넘치게(끝이 어둠에 묻히도록)

function Column({ angle }: { angle: number }) {
  const m = materials();
  const pitch = H + GAP;
  return (
    <group rotation-y={angle}>
      <group position={[0, 0, -RADIUS]}>
        {/* 몸통 */}
        <mesh position={[0, 0, -0.35]} material={m.dark}>
          <boxGeometry args={[W + 2 * T, ROWS * pitch + 2 * T, 0.7]} />
        </mesh>
        {/* 옆 기둥과 나뉘는 세로 이음매 — 서류함 한 짝의 경계 */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * (W + T)) / 2, 0, 0.01]} material={m.dark}>
            <boxGeometry args={[T, ROWS * pitch + 2 * T, 0.09]} />
          </mesh>
        ))}
        {Array.from({ length: ROWS }, (_, i) => {
          const y = (i - (ROWS - 1) / 2) * pitch;
          return (
            <group key={i} position={[0, y, 0]}>
              {/* 서랍 전면 */}
              <RoundedBox args={[W - T, H, 0.06]} radius={0.012} smoothness={2} material={m.steel} />
              {/* 라벨 홀더 */}
              <RoundedBox args={[0.5, 0.14, 0.02]} radius={0.004} position={[0, H * 0.27, 0.04]} material={m.metal} />
              {/* 손잡이 */}
              <RoundedBox args={[0.46, 0.05, 0.06]} radius={0.02} smoothness={3} position={[0, -H * 0.24, 0.06]} material={m.metal} />
            </group>
          );
        })}
      </group>
    </group>
  );
}

/* 둘러선 벽만 — 5번 아카이빙 룸에서도 같은 방을 쓴다 */
export function Wall() {
  return (
    <>
      {Array.from({ length: COLUMNS }, (_, i) => (
        <Column key={i} angle={(i / COLUMNS) * Math.PI * 2} />
      ))}
    </>
  );
}

export const WALL_RADIUS = RADIUS;

export default function CabinetWall({
  tracks,
  index,
  playing,
  saving = false,
  tag = "",
  onPlay,
  onDiscard,
}: {
  tracks: Track[];
  index: number;
  playing: number | null;
  saving?: boolean; // 서랍에 넣는 중
  tag?: string; // 네임택에 찍히는 글자 (타자기로 한 글자씩)
  onPlay: (t: Track) => void;
  onDiscard: (t: Track) => void;
}) {
  return (
    <div className="fixed inset-0">
      <Canvas frameloop="demand" camera={{ position: [0, 0, 0], fov: 62 }} dpr={[1, 1.5]}>
        {/* 검은 공간에 흰 서류함만 떠오른다 — 멀어질수록 어둠에 잠긴다 */}
        <color attach="background" args={["#000000"]} />
        <fog attach="fog" args={["#000000", 7, 14]} />
        <ambientLight intensity={0.1} />
        {/* 눈높이에서만 벽을 비춘다 — 좌우는 촘촘히 이어지고 위아래는 어둠에 잠겨 공간이 열린다 */}
        <pointLight position={[0, 0, 0.6]} intensity={60} distance={15} decay={2.2} color="#ffffff" />
        <pointLight position={[0, -0.6, -2]} intensity={16} distance={11} decay={2.4} color="#cfe6f5" />
        {Array.from({ length: COLUMNS }, (_, i) => (
          <Column key={i} angle={(i / COLUMNS) * Math.PI * 2} />
        ))}
        {/* 결과 디스크(3D)와, 손을 떠나 날아다니는 디스크 */}
        <Deck tracks={tracks} index={index} playing={playing} saving={saving} onPlay={onPlay} onDiscard={onDiscard} />
        <Flights wallRadius={RADIUS} />
        {/* 남긴 디스크를 받아 가는 서랍 — 아래에서 올라와 삼키고 닫힌다 */}
        <SaveDrawer open={saving} tag={tag} />
      </Canvas>
      {/* 위아래는 어둠에 잠긴다 — 좌우로는 촘촘히 이어지고 천장·바닥 쪽으로 공간이 열린 느낌 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(#000_4%,rgba(0,0,0,.75)_18%,transparent_38%,transparent_60%,rgba(0,0,0,.8)_82%,#000_96%)]" />
    </div>
  );
}
