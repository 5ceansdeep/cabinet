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
const MAX_FOLDERS = 160;

/* 서랍 한 칸. slide 만큼 앞으로 빠지며, 열릴 땐 촤르륵·닫힐 땐 "탁" 빠르게.
   브루스 올마이티의 끝없는 서랍처럼 몸통이 빠진 길이만큼 늘어나고, 그 안을 폴더가 빽빽이 채운다 */
export default function Drawer({
  y,
  slide,
  label,
  knock = false,
  children,
}: {
  y: number;
  slide: number;
  label: string;
  knock?: boolean; // 열리기 전 호버를 부르는 톡톡
  children?: ReactNode;
}) {
  const group = useRef<Group>(null!);
  const base = useRef(FRONT_Z); // 톡톡을 뺀 실제 서랍 위치
  const body = useRef<Group>(null!);
  const folders = useRef<InstancedMesh>(null!);
  const glow = useRef<PointLight>(null!);
  const m = materials();

  useLayoutEffect(() => {
    const o = new Object3D();
    const manila = new Color("#d9c28f");
    const paper = new Color("#f3efe4");
    for (let i = 0; i < MAX_FOLDERS; i++) {
      // 살짝씩 어긋나게 — 손으로 꽂은 듯
      o.position.set(Math.sin(i * 12.9) * 0.02, -H * 0.4 + FOLDER.h / 2 + 0.01 + Math.sin(i * 7.3) * 0.015, -0.45 - i * SPACING);
      o.rotation.set(Math.sin(i * 3.1) * 0.06, 0, 0);
      o.updateMatrix();
      folders.current.setMatrixAt(i, o.matrix);
      folders.current.setColorAt(i, i % 3 ? manila : paper);
    }
  }, []);

  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-(FRONT_Z + slide > base.current ? 3 : 14) * dt);
    base.current += (FRONT_Z + slide - base.current) * k;
    // 톡톡 — 3초마다 안에서 누가 두드리듯 두 번 들썩인다
    const t = clock.elapsedTime % 3;
    const bump = knock && t < 0.36 ? Math.abs(Math.sin((t / 0.36) * Math.PI * 2)) * 0.03 : 0;
    const g = group.current.position;
    g.z = base.current + bump;
    // 몸통 뒤끝은 서류함 안에 머물고 앞으로 빠진 만큼 길어진다
    const len = base.current - FRONT_Z + BODY;
    body.current.scale.z = len;
    folders.current.count = Math.max(0, Math.min(MAX_FOLDERS, Math.floor((len - 0.5) / SPACING)));
    // 서랍 속에서 새어 나오는 하얀 빛
    glow.current.intensity += ((slide > 0 ? 1.2 : 0) - glow.current.intensity) * k;
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
