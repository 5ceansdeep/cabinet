"use client";

import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, SRGBColorSpace } from "three";
import { coverColors } from "./flying";
import { loadArt, type Track } from "./tracks";

/* 3D 플로피 한 장 — 검은 몸체, 금속 셔터, 앨범 커버가 인쇄된 라벨.
   라벨의 점수 줄은 타자기처럼 한 글자씩 찍히므로 글자 수(typed)에 따라 다시 그린다 */

export const DISK = 0.95; // 한 변 (월드 단위)
/* 라벨 그림 배율 — 좌표는 512 기준으로 쓰고 이만큼 크게 그린다. 폰 가운데 디스크 라벨은 화면에서 1300px 넘게 커져
   512 로는 제목·일치도가 뭉개졌다(10/6 사용자). ponytail: 디스크당 1024² 텍스처 ≈ 5MB(밉맵 포함) — 10장이면 50MB, 폰이 버거우면 768 로 */
const RES = 2;

export function useLabel(track: Track, onArt?: () => void) {
  return useMemo(() => {
    const [a, b] = coverColors(track.cover);
    const c = document.createElement("canvas");
    c.width = c.height = 512 * RES;
    const ctx = c.getContext("2d")!;
    ctx.scale(RES, RES);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8; // 비스듬한 옆 디스크 라벨도 덜 뭉개지게(렌더러가 기기 최대치로 자른다)
    // 점수를 모르면(보관소에 꽂힌 곡) 가수 이름을 찍는다
    const score = track.semantic ? `[일치도: ${track.semantic}%]` : track.artist;
    // 앨범 커버 — 받아지기 전엔 그라디언트, 받으면 그 위에 다시 그린다 (iTunes 커버는 CORS 를 열어 둬 캔버스에 써도 된다)
    const st: { art: HTMLImageElement | null; last: number } = { art: null, last: 0 };
    const draw = (typed: number) => {
      st.last = typed;
      const art = st.art;
      if (art) {
        // 정사각 커버를 라벨 위칸(512×380)에 가운데 맞춰 채운다
        ctx.drawImage(art, 0, (art.height - (art.width * 380) / 512) / 2, art.width, (art.width * 380) / 512, 0, 0, 512, 380);
      } else {
        const g = ctx.createLinearGradient(0, 0, 512, 380);
        g.addColorStop(0, a);
        g.addColorStop(1, b);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 512, 380);
      }
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
    if (track.artwork)
      loadArt(track.artwork)
        .then((img) => {
          st.art = img;
          draw(st.last);
          onArt?.();
        })
        .catch(() => undefined); // 표지를 못 받으면 그라디언트 그대로
    return { tex, draw, length: score.length };
  }, [track]); // eslint-disable-line react-hooks/exhaustive-deps
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
      {/* 앨범 커버가 인쇄된 라벨 — 조명을 안 받는 재질. 앞에서 비추는 빛에 맨 앞 디스크 표지가 하얗게 날아갔다(10/1) */}
      <mesh position={[0, -DISK * 0.11, 0.037]}>
        <planeGeometry args={[DISK * 0.78, DISK * 0.62]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
      {/* 뒷면 — 금속 드라이브 허브 */}
      <mesh position={[0, 0, -0.037]} rotation-y={Math.PI}>
        <circleGeometry args={[DISK * 0.17, 24]} />
        <meshStandardMaterial color="#9aa3af" metalness={1} roughness={0.35} />
      </mesh>
    </>
  );
}
