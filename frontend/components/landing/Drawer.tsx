"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Color, Object3D, type Group, type InstancedMesh, type PointLight } from "three";
import { CABINET, FRONT_Z } from "./dimensions";
import { labelMaterial, materials } from "./materials";

const { W, H, D } = CABINET;
export const BODY = D - 0.15; // 서랍 몸통 깊이
export const FOLDER = { w: W - 0.3, h: 0.46 }; // 행잉 폴더 크기

const SPACING = 0.06; // 폴더 간격
const wobble = new Object3D(); // 파도칠 때 행렬 계산용

/* 안에서 뭔가 부딪힌 듯 — 때린 순간 확 흔들렸다가 빠르게 잦아든다 */
const jolt = (t: number) => (t < 0 ? 0 : Math.exp(-t * 14) * Math.sin(t * 90));
const MAX_FOLDERS = 160;

/* 서랍 한 칸. slide 만큼 앞으로 빠지며, 열릴 땐 촤르륵·닫힐 땐 "탁" 빠르게.
   브루스 올마이티의 끝없는 서랍처럼 몸통이 빠진 길이만큼 늘어나고, 그 안을 폴더가 빽빽이 채운다 */
export default function Drawer({
  y,
  slide,
  label,
  knock = false,
  wave = false,
  children,
}: {
  y: number;
  slide: number;
  label: string;
  knock?: boolean; // 열리기 전 — 덜컹거리며 열릴까 말까 한다
  wave?: boolean; // 안의 파일들이 앞에서부터 파도처럼 올라왔다 내려간다
  children?: ReactNode;
}) {
  const group = useRef<Group>(null!);
  const base = useRef(FRONT_Z); // 톡톡을 뺀 실제 서랍 위치
  const body = useRef<Group>(null!);
  const folders = useRef<InstancedMesh>(null!);
  const glow = useRef<PointLight>(null!);
  const waving = useRef(0); // 파도 세기 0~1
  const seats = useRef<{ x: number; y: number; z: number; tilt: number }[]>([]); // 폴더 제자리 — 파도칠 때 여기서 들린다
  const m = materials();

  useLayoutEffect(() => {
    const o = new Object3D();
    const manila = new Color("#d9c28f");
    const paper = new Color("#f3efe4");
    for (let i = 0; i < MAX_FOLDERS; i++) {
      // 살짝씩 어긋나게 — 손으로 꽂은 듯
      const seat = {
        x: Math.sin(i * 12.9) * 0.02,
        y: -H * 0.4 + FOLDER.h / 2 + 0.01 + Math.sin(i * 7.3) * 0.015,
        z: -0.45 - i * SPACING,
        tilt: Math.sin(i * 3.1) * 0.06,
      };
      seats.current[i] = seat;
      o.position.set(seat.x, seat.y, seat.z);
      o.rotation.set(seat.tilt, 0, 0);
      o.updateMatrix();
      folders.current.setMatrixAt(i, o.matrix);
      folders.current.setColorAt(i, i % 3 ? manila : paper);
    }
  }, []);

  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-(FRONT_Z + slide > base.current ? 3 : 14) * dt);
    base.current += (FRONT_Z + slide - base.current) * k;
    // 덜컹 — 3초마다 서랍 안에서 뭔가 두 번 부딪힌다. 서랍은 제자리, 충격만 전해진다
    const t = clock.elapsedTime % 3;
    const hit = knock ? jolt(t) + jolt(t - 0.26) * 0.7 : 0;
    const g = group.current.position;
    g.z = base.current + Math.abs(hit) * 0.012; // 앞으로 아주 조금 들썩
    g.y = y + hit * 0.004; // 위아래로 달그락
    group.current.rotation.x = hit * 0.006; // 살짝 기울었다 돌아온다
    // 몸통 뒤끝은 서류함 안에 머물고 앞으로 빠진 만큼 길어진다
    const len = base.current - FRONT_Z + BODY;
    body.current.scale.z = len;
    folders.current.count = Math.max(0, Math.min(MAX_FOLDERS, Math.floor((len - 0.5) / SPACING)));
    // 서랍 속에서 새어 나오는 하얀 빛 — 살짝 밀려 나온 틈으로도 샌다
    glow.current.intensity += ((slide > 0 ? 1.2 : Math.abs(hit) * 0.5) - glow.current.intensity) * k;

    // 파일 파도 — 앞에서부터 차례로 살짝 올라왔다 내려간다 (서류 정리 중)
    const shiver = knock ? Math.abs(hit) : 0; // 부딪힐 때 안의 파일도 들썩
    if (wave || waving.current > 0.01 || shiver > 0.001) {
      waving.current += ((wave ? 1 : 0) - waving.current) * (1 - Math.exp(-4 * dt));
      const o = wobble;
      for (let i = 0; i < folders.current.count; i++) {
        const seat = seats.current[i];
        if (!seat) continue;
        const lift =
          Math.max(0, Math.sin(clock.elapsedTime * 3 - i * 0.55)) ** 3 * 0.06 * waving.current + // 파도
          shiver * 0.02 * Math.sin(i * 2.3); // 달그락
        o.position.set(seat.x, seat.y + lift, seat.z);
        o.rotation.set(seat.tilt - lift * 0.6, 0, 0);
        o.updateMatrix();
        folders.current.setMatrixAt(i, o.matrix);
      }
      folders.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={group} position={[0, y, FRONT_Z]}>
      <RoundedBox args={[W - 0.04, H, 0.05]} radius={0.012} smoothness={3} castShadow receiveShadow material={m.steel} />

      {/* 라벨 홀더 — 금속 프레임 안에 종이 라벨 */}
      <RoundedBox args={[0.5, 0.14, 0.012]} radius={0.004} position={[0, H * 0.27, 0.03]} castShadow material={m.metal} />
      <mesh position={[0, H * 0.27, 0.037]} material={labelMaterial(label)}>
        <planeGeometry args={[0.44, 0.1]} />
      </mesh>

      {/* 손잡이 */}
      <RoundedBox args={[0.46, 0.05, 0.06]} radius={0.02} smoothness={4} position={[0, -H * 0.24, 0.05]} castShadow material={m.metal} />

      {/* 몸통 — 깊이 1 짜리를 len 만큼 z 로 늘린다 */}
      <group ref={body}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (W / 2 - 0.08), -0.05, -0.5]} castShadow receiveShadow material={m.steel}>
            <boxGeometry args={[0.02, H * 0.7, 1]} />
          </mesh>
        ))}
        <mesh position={[0, -H * 0.4, -0.5]} castShadow receiveShadow material={m.steel}>
          <boxGeometry args={[W - 0.16, 0.02, 1]} />
        </mesh>
      </group>
      {/* 빽빽한 행잉 폴더들 (장식) */}
      <instancedMesh ref={folders} args={[undefined, m.folder, MAX_FOLDERS]} receiveShadow>
        <boxGeometry args={[FOLDER.w, FOLDER.h, 0.008]} />
      </instancedMesh>
      <pointLight ref={glow} position={[0, 0.15, -0.3]} intensity={0} distance={1.8} />
      {children}
    </group>
  );
}
