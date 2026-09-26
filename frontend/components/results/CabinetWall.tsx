"use client";

import { Canvas } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { BoxGeometry, Matrix4, type BufferGeometry, type InstancedMesh, type Material } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
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

/* 둘러선 벽 — 서랍이 기둥 수 × 줄 수만큼(수백 개) 있어 부품마다 InstancedMesh 하나로 그린다.
   RoundedBox 를 하나씩 두면 지오메트리를 천 개 넘게 만들어 첫 화면이 한참 늦게 뜬다 */
function Parts({ geometry, material, at }: { geometry: BufferGeometry; material: Material; at: Matrix4[] }) {
  const ref = useRef<InstancedMesh>(null!);
  useLayoutEffect(() => {
    at.forEach((m, i) => ref.current.setMatrixAt(i, m));
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [at]);
  return <instancedMesh ref={ref} args={[geometry, material, at.length]} />;
}

const pitch = H + GAP;
const tall = ROWS * pitch + 2 * T;
// 기둥 각도 × 기둥 안의 자리 → 월드 행렬
const place = (angle: number, x: number, y: number, z: number) =>
  new Matrix4().makeRotationY(angle).multiply(new Matrix4().makeTranslation(x, y, z - RADIUS));

export function Wall() {
  const m = materials();
  const parts = useMemo(() => {
    const geo = {
      body: new BoxGeometry(W + 2 * T, tall, 0.7),
      seam: new BoxGeometry(T, tall, 0.09),
      front: new RoundedBoxGeometry(W - T, H, 0.06, 2, 0.012),
      holder: new RoundedBoxGeometry(0.5, 0.14, 0.02, 1, 0.004),
      handle: new RoundedBoxGeometry(0.46, 0.05, 0.06, 3, 0.02),
    };
    const at = { body: [] as Matrix4[], seam: [] as Matrix4[], front: [] as Matrix4[], holder: [] as Matrix4[], handle: [] as Matrix4[] };
    for (let c = 0; c < COLUMNS; c++) {
      const a = (c / COLUMNS) * Math.PI * 2;
      at.body.push(place(a, 0, 0, -0.35));
      // 옆 기둥과 나뉘는 세로 이음매 — 서류함 한 짝의 경계
      for (const s of [-1, 1]) at.seam.push(place(a, (s * (W + T)) / 2, 0, 0.01));
      for (let i = 0; i < ROWS; i++) {
        const y = (i - (ROWS - 1) / 2) * pitch;
        at.front.push(place(a, 0, y, 0));
        at.holder.push(place(a, 0, y + H * 0.27, 0.04)); // 라벨 홀더
        at.handle.push(place(a, 0, y - H * 0.24, 0.06)); // 손잡이
      }
    }
    return { geo, at };
  }, []);
  const { geo, at } = parts;
  return (
    <>
      <Parts geometry={geo.body} material={m.dark} at={at.body} />
      <Parts geometry={geo.seam} material={m.dark} at={at.seam} />
      <Parts geometry={geo.front} material={m.steel} at={at.front} />
      <Parts geometry={geo.holder} material={m.metal} at={at.holder} />
      <Parts geometry={geo.handle} material={m.metal} at={at.handle} />
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
  onInsert,
  onEject,
  onDiscard,
}: {
  tracks: Track[];
  index: number;
  playing: Track | null; // 드라이브에 꽂힌 디스크
  saving?: boolean; // 서랍에 넣는 중
  tag?: string; // 네임택에 찍히는 글자 (타자기로 한 글자씩)
  onInsert: (t: Track) => void;
  onEject: () => void;
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
        <Wall />
        {/* 결과 디스크(3D)와, 손을 떠나 날아다니는 디스크 */}
        <Deck tracks={tracks} index={index} playing={playing} saving={saving} onInsert={onInsert} onEject={onEject} onDiscard={onDiscard} />
        <Flights wallRadius={RADIUS} />
        {/* 남긴 디스크를 받아 가는 서랍 — 아래에서 올라와 삼키고 닫힌다 */}
        <SaveDrawer open={saving} tag={tag} />
      </Canvas>
      {/* 위아래는 어둠에 잠긴다 — 좌우로는 촘촘히 이어지고 천장·바닥 쪽으로 공간이 열린 느낌 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(#000_4%,rgba(0,0,0,.75)_18%,transparent_38%,transparent_70%,rgba(0,0,0,.7)_88%,#000_98%)]" />
    </div>
  );
}
