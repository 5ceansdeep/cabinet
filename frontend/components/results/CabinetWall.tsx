"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BoxGeometry, Matrix4, type BufferGeometry, type Group, type InstancedMesh, type Material } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CABINET } from "@/components/landing/dimensions";
import { materials } from "@/components/landing/materials";
import { thud } from "@/lib/thud";
import { keepContext } from "@/lib/gl";
import { useReducedMotion } from "@/lib/motion";
import { COLUMNS, RADIUS, REVEAL, ROWS } from "./room";
import Deck from "./Deck";
import Flights from "./Flights";
import SaveDrawer from "./SaveDrawer";
import type { Track } from "./tracks";

/* 4번 배경 — 랜딩과 같은 서류함(치수·재료 그대로)이 시야를 빙 둘러 서 있다.
   카메라는 그 한가운데. 어두운 안개에 잠겨 위아래·좌우 끝이 안 보인다.
   frameloop="demand" — 움직이지 않는 배경이라 첫 프레임만 그리고 논다 */

const { W, H, GAP, T } = CABINET;

/* 둘러선 벽 — 서랍이 기둥 수 × 줄 수만큼(수백 개) 있어 부품마다 InstancedMesh 하나로 그린다.
   RoundedBox 를 하나씩 두면 지오메트리를 천 개 넘게 만들어 첫 화면이 한참 늦게 뜬다 */
function Parts({ geometry, material, at, mesh }: { geometry: BufferGeometry; material: Material; at: Matrix4[]; mesh?: RefObject<InstancedMesh | null> }) {
  const own = useRef<InstancedMesh>(null);
  const ref = mesh ?? own;
  useLayoutEffect(() => {
    at.forEach((m, i) => ref.current!.setMatrixAt(i, m));
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [at, ref]);
  return <instancedMesh ref={ref} args={[geometry, material, at.length]} />;
}

/* 서랍 뒤지기 — 곡을 찾는 동안 보이는 서랍들이 여기저기서 탁 빠졌다 닫힌다(10/1, 검은 카드 넘김 화면 대신).
   결과가 오면 정면 한 칸 아래 서랍이 몸통째 쭉 빠지고, 디스크들이 거기서 솟아오른다(room.ts REVEAL, Deck) */
const SEEN_COLS = 3; // 정면에서 좌우로 이만큼 기둥까지만 — 화면 밖 서랍은 안 뒤진다
const SEEN_ROWS = [3, 9]; // 이 줄 사이만 — 위아래는 어둠에 잠겨 안 보인다
const PULL = { out: 0.22, hold: 0.12, back: 0.26, depth: 0.42 }; // 뒤질 때 한 칸 — 초, 빠지는 거리
const ease = (x: number) => 1 - (1 - x) ** 3;
/** 시작 t 초 뒤 빠진 몫 0~1 — 빠르게 빠졌다 잠깐 멈추고 닫힌다 */
const pulled = (t: number, p: { out: number; hold: number; back: number }) =>
  t < p.out ? ease(t / p.out) : t < p.out + p.hold ? 1 : Math.max(0, 1 - ease((t - p.out - p.hold) / p.back));

const pitch = H + GAP;
const tall = ROWS * pitch + 2 * T;
// 기둥 각도 × 기둥 안의 자리 → 월드 행렬. out 을 주면 거기에 쓴다 — 뒤지는 동안 매 프레임 새 행렬을 만들지 않게
const _turn = new Matrix4();
const _move = new Matrix4();
const _at = new Matrix4();
const place = (angle: number, x: number, y: number, z: number, out = new Matrix4()) =>
  out.copy(_turn.makeRotationY(angle)).multiply(_move.makeTranslation(x, y, z - RADIUS));

export function Wall({ rummage = false, reveal = 0 }: { rummage?: boolean; reveal?: number }) {
  const m = materials();
  const front = useRef<InstancedMesh>(null);
  const holder = useRef<InstancedMesh>(null);
  const handle = useRef<InstancedMesh>(null);
  const tray = useRef<Group>(null!);
  const pulls = useRef(new Map<number, { t0: number; p: typeof PULL }>()); // 서랍 번호 → 빠지기 시작한 때
  const next = useRef(0); // 다음 서랍을 뒤질 때
  const { invalidate } = useThree();
  const reduce = useReducedMotion(); // 감속 모드 — 뒤지기·결과 서랍이 빠졌다 닫히는 움직임 없이(디스크는 바로 줄에)
  // 뒤지기·결과가 시작되면 깨운다 — 멎은 장면은 그리지 않는다(frameloop="demand")
  useEffect(() => invalidate(), [rummage, reveal, invalidate]);
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

  // 결과가 왔다 — 정면 서랍을 쭉 뺀다(reveal 이 바뀔 때마다)
  const revealed = useRef(0);
  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const map = pulls.current;
    const revIdx = REVEAL.col * ROWS + REVEAL.row;
    if (reveal !== revealed.current) {
      revealed.current = reveal;
      if (reveal && !reduce) map.set(revIdx, { t0: now, p: { ...PULL, ...REVEAL } });
    }
    // 뒤지는 중 — 보이는 서랍 하나를 골라 탁
    if (rummage && !reduce && now >= next.current) {
      const c = (Math.round((Math.random() * 2 - 1) * SEEN_COLS) + COLUMNS) % COLUMNS;
      const r = SEEN_ROWS[0] + Math.floor(Math.random() * (SEEN_ROWS[1] - SEEN_ROWS[0] + 1));
      if (!map.has(c * ROWS + r)) map.set(c * ROWS + r, { t0: now, p: PULL });
      next.current = now + 0.12 + Math.random() * 0.22;
    }
    if (!map.size && (!rummage || reduce)) return;
    for (const [idx, { t0, p }] of map) {
      const t = now - t0;
      const done = t > p.out + p.hold + p.back;
      const d = done ? 0 : pulled(t, p) * p.depth;
      const c = Math.floor(idx / ROWS);
      const r = idx % ROWS;
      const a = (c / COLUMNS) * Math.PI * 2;
      const y = (r - (ROWS - 1) / 2) * pitch;
      front.current!.setMatrixAt(idx, place(a, 0, y, d, _at));
      holder.current!.setMatrixAt(idx, place(a, 0, y + H * 0.27, 0.04 + d, _at));
      handle.current!.setMatrixAt(idx, place(a, 0, y - H * 0.24, 0.06 + d, _at));
      if (idx === revIdx) {
        // 결과 서랍은 몸통(옆판·바닥)이 따라 나온다 — 앞판만 뜨면 어색하다
        tray.current.visible = d > 0.01;
        tray.current.position.set(0, y, -RADIUS + d / 2);
        tray.current.scale.set(1, 1, Math.max(0.01, d));
      }
      if (done) {
        map.delete(idx);
        if (p === PULL) thud(120 + Math.random() * 60); // 닫히며 "탁"
      }
    }
    front.current!.instanceMatrix.needsUpdate = true;
    holder.current!.instanceMatrix.needsUpdate = true;
    handle.current!.instanceMatrix.needsUpdate = true;
    invalidate();
  });

  return (
    <>
      <Parts geometry={geo.body} material={m.dark} at={at.body} />
      <Parts geometry={geo.seam} material={m.dark} at={at.seam} />
      <Parts geometry={geo.front} material={m.steel} at={at.front} mesh={front} />
      <Parts geometry={geo.holder} material={m.metal} at={at.holder} mesh={holder} />
      <Parts geometry={geo.handle} material={m.metal} at={at.handle} mesh={handle} />
      {/* 결과 서랍의 몸통 — 길이 1 짜리를 빠진 만큼 늘린다 */}
      <group ref={tray} visible={false}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * (W - T)) / 2, 0, 0]} material={m.steel}>
            <boxGeometry args={[0.02, H * 0.8, 1]} />
          </mesh>
        ))}
        <mesh position={[0, -H * 0.4, 0]} material={m.steel}>
          <boxGeometry args={[W - T, 0.02, 1]} />
        </mesh>
      </group>
    </>
  );
}

export const WALL_RADIUS = RADIUS;

export default function CabinetWall({
  tracks,
  index,
  playing,
  saving = false,
  searching = false,
  reveal = 0,
  tag = "",
  onInsert,
  onEject,
  onDiscard,
}: {
  tracks: Track[];
  index: number;
  playing: Track | null; // 드라이브에 꽂힌 디스크
  saving?: boolean; // 서랍에 넣는 중
  searching?: boolean; // 곡을 찾는 중 — 벽 서랍들이 탁탁 빠졌다 닫힌다
  reveal?: number; // 바뀔 때마다 정면 서랍이 쭉 빠지고 디스크가 거기서 나온다
  tag?: string; // 네임택에 찍히는 글자 (타자기로 한 글자씩)
  onInsert: (t: Track) => void;
  onEject: () => void;
  onDiscard: (t: Track) => void;
}) {
  return (
    <div className="fixed inset-0">
      <Canvas frameloop="demand" camera={{ position: [0, 0, 0], fov: 62 }} dpr={[1, 1.5]} onCreated={keepContext}>
        {/* 검은 공간에 흰 서류함만 떠오른다 — 멀어질수록 어둠에 잠긴다 */}
        <color attach="background" args={["#000000"]} />
        <fog attach="fog" args={["#000000", 7, 14]} />
        <ambientLight intensity={0.1} />
        {/* 눈높이에서만 벽을 비춘다 — 좌우는 촘촘히 이어지고 위아래는 어둠에 잠겨 공간이 열린다 */}
        <pointLight position={[0, 0, 0.6]} intensity={60} distance={15} decay={2.2} color="#ffffff" />
        <pointLight position={[0, -0.6, -2]} intensity={16} distance={11} decay={2.4} color="#cfe6f5" />
        <Wall rummage={searching} reveal={reveal} />
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
