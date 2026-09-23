"use client";

import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, SRGBColorSpace } from "three";
import { coverColors } from "./flying";
import type { Track } from "./tracks";

/* 3D 플로피 한 장 — 검은 몸체, 금속 셔터, 앨범 커버가 인쇄된 라벨.
   라벨의 점수 줄은 타자기처럼 한 글자씩 찍히므로 글자 수(typed)에 따라 다시 그린다 */

export const DISK = 0.95; // 한 변 (월드 단위)

export function useLabel(track: Track) {
  return useMemo(() => {
    const [a, b] = coverColors(track.cover);
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const score = `[의미 유사도: ${track.semantic}% | 분위기 일치도: ${track.mood}%]`;
    const draw = (typed: number) => {
      const g = ctx.createLinearGradient(0, 0, 512, 380);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 380);
      ctx.fillStyle = "#ece8dc";
      ctx.fillRect(0, 380, 512, 132);
      ctx.fillStyle = "#212529";
      ctx.font = '600 40px "Courier New", monospace';
      ctx.fillText(track.title.slice(0, 16), 16, 432);
      ctx.fillStyle = "#0a6e7a";
      ctx.font = '600 22px "Courier New", monospace';
      ctx.fillText(score.slice(0, typed), 16, 478);
      tex.needsUpdate = true;
    };
    draw(0);
    return { tex, draw, length: score.length };
  }, [track]);
}

export function FloppyBody({ map }: { map: CanvasTexture }) {
  return (
    <>
      {/* 몸체 — 검은 플라스틱 */}
      <RoundedBox args={[DISK, DISK, 0.07]} radius={0.02} smoothness={3} castShadow>
        <meshStandardMaterial color="#1c2230" roughness={0.85} />
      </RoundedBox>
      {/* 금속 셔터 */}
      <mesh position={[0, DISK * 0.32, 0.037]}>
        <planeGeometry args={[DISK * 0.46, DISK * 0.3]} />
        <meshStandardMaterial color="#aab1bb" metalness={0.5} roughness={0.6} />
      </mesh>
      {/* 앨범 커버가 인쇄된 라벨 */}
      <mesh position={[0, -DISK * 0.11, 0.037]}>
        <planeGeometry args={[DISK * 0.78, DISK * 0.62]} />
        <meshStandardMaterial map={map} roughness={1} metalness={0} />
      </mesh>
      {/* 뒷면 — 금속 드라이브 허브 */}
      <mesh position={[0, 0, -0.037]} rotation-y={Math.PI}>
        <circleGeometry args={[DISK * 0.17, 24]} />
        <meshStandardMaterial color="#9aa3af" metalness={1} roughness={0.35} />
      </mesh>
    </>
  );
}
