"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { Group } from "three";
import { CABINET } from "@/components/landing/dimensions";
import { labelMaterial, materials } from "@/components/landing/materials";

/* 남긴 디스크를 받아 가는 서랍 — 화면 아래에서 스르륵 올라와 열려 있다가, 다 삼키면 "탁" 닫히고 내려간다.
   디스크가 빨려 드는 자리(MOUTH)는 Deck 이 목표 지점으로 쓴다 */

const { W, H, D, T } = CABINET;
export const MOUTH: [number, number, number] = [0, -1.15, -2.6]; // 서랍 입 — 화면 아래 가운데

export default function SaveDrawer({ open, tag }: { open: boolean; tag: string }) {
  const g = useRef<Group>(null!);
  const m = materials();
  const { invalidate } = useThree();

  useFrame((_, dt) => {
    const to = open ? MOUTH[1] : MOUTH[1] - 1.4; // 닫히면 화면 밖으로 내려간다
    if (Math.abs(g.current.position.y - to) > 0.002) {
      g.current.position.y += (to - g.current.position.y) * (1 - Math.exp(-5 * dt));
      invalidate();
    }
  });

  return (
    <group ref={g} position={[MOUTH[0], MOUTH[1] - 1.4, MOUTH[2]]} rotation={[-0.5, 0, 0]}>
      {/* 열린 서랍 — 안이 보이게 앞으로 기울어 있다 */}
      <mesh position={[0, -H * 0.4, -D / 2]} material={m.steel}>
        <boxGeometry args={[W - 0.16, 0.02, D]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.08), -0.05, -D / 2]} material={m.steel}>
          <boxGeometry args={[0.02, H * 0.7, D]} />
        </mesh>
      ))}
      {/* 전면 + 네임택 + 손잡이 */}
      <RoundedBox args={[W - 0.04, H, 0.05]} radius={0.012} smoothness={3} material={m.steel} />
      <RoundedBox args={[0.5, 0.14, 0.012]} radius={0.004} position={[0, H * 0.27, 0.03]} material={m.metal} />
      <mesh position={[0, H * 0.27, 0.037]} material={labelMaterial(tag || " ")}>
        <planeGeometry args={[0.44, 0.1]} />
      </mesh>
      <RoundedBox args={[0.46, 0.05, 0.06]} radius={0.02} smoothness={4} position={[0, -H * 0.24, 0.05]} material={m.metal} />
      <mesh position={[0, 0, -T]} material={m.dark}>
        <boxGeometry args={[W, H * 0.9, 0.02]} />
      </mesh>
    </group>
  );
}
