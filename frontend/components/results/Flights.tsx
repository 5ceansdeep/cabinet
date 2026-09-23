"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, SRGBColorSpace, Vector3, type Group } from "three";
import { thud } from "@/lib/thud";
import { coverColors, onToss, type Toss } from "./flying";

/* 던져진 플로피 — 진짜 3D 물체로 날아간다. 중력을 받고, 빙 둘러선 서류함 벽(원통)에 부딪혀 튕기고,
   바닥에 떨어져 몇 번 구르다 멎으면 목록에서 빠진다. CabinetWall 의 Canvas 안에서만 쓴다. */

const G = 13; // 중력 (월드 단위/s²)
const FLOOR = -2.2; // 바닥 높이
const WALL_BOUNCE = 0.55;
const FLOOR_BOUNCE = 0.42;
const SPAWN_Z = -2.6; // 손을 떠나는 깊이 — 카메라 앞
const MIN_UP = 10.5; // 살살 뿌려도 이만큼은 솟구친다 (월드 단위/s)
const TO_WALL = 7; // 벽 쪽(뒤)으로 밀어주는 속도

type Flight = {
  id: number;
  toss: Toss;
  p: Vector3;
  v: Vector3;
  spin: Vector3;
  rest: number; // 바닥에서 잠잠해진 시간(s)
};

/* 라벨 — 앨범 커버 두 색과 곡 제목을 캔버스에 그려 텍스처로 */
function labelTexture(title: string, cover: string) {
  const [a, b] = coverColors(cover);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 256, 200);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 200);
  ctx.fillStyle = "#ece8dc";
  ctx.fillRect(0, 200, 256, 56);
  ctx.fillStyle = "#212529";
  ctx.font = '600 22px "Courier New", monospace';
  ctx.fillText(title.slice(0, 14), 12, 236);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// 날아다니는 디스크들 — 매 프레임 바뀌는 물리 상태라 리액트 바깥에서 들고 있는다
const active = new Map<number, Flight>();
let nextId = 0;

function Floppy({ flight }: { flight: Flight }) {
  const ref = useRef<Group>(null!);
  const map = useMemo(() => labelTexture(flight.toss.track.title, flight.toss.track.cover), [flight]);
  useFrame(() => {
    ref.current.position.copy(flight.p);
    ref.current.rotation.set(flight.spin.x, flight.spin.y, flight.spin.z);
  });
  return (
    <group ref={ref}>
      {/* 몸체 — 검은 플라스틱 */}
      <RoundedBox args={[0.62, 0.62, 0.05]} radius={0.015} smoothness={2}>
        <meshStandardMaterial color="#1c2230" roughness={0.6} />
      </RoundedBox>
      {/* 앨범 커버가 인쇄된 라벨 */}
      <mesh position={[0, -0.06, 0.028]}>
        <planeGeometry args={[0.46, 0.4]} />
        <meshStandardMaterial map={map} roughness={0.85} />
      </mesh>
      {/* 금속 셔터 */}
      <mesh position={[0, 0.2, 0.031]}>
        <planeGeometry args={[0.3, 0.2]} />
        <meshStandardMaterial color="#c9ced6" metalness={0.9} roughness={0.35} />
      </mesh>
      {/* 저 혼자 빛을 내어 어둠 속에서도 보이고, 부딪히는 서랍도 잠깐 밝힌다 */}
      <pointLight position={[0, 0, 0.5]} intensity={9} distance={5} decay={2} color="#e8f4ff" />
    </group>
  );
}

export default function Flights({ wallRadius }: { wallRadius: number }) {
  const { camera, size, invalidate } = useThree();
  const [ids, setIds] = useState<number[]>([]); // 지금 날고 있는 디스크들

  useEffect(() => {
    const off = onToss((toss) => {
      // 손을 떠난 화면 좌표 → 월드 위치. 그 깊이에서 화면 1px 이 몇 월드인지도 같이 구한다
      const dist = Math.abs(SPAWN_Z);
      const h = 2 * dist * Math.tan(((camera as unknown as { fov: number }).fov * Math.PI) / 360);
      const perPx = h / size.height;
      const id = nextId++;
      active.set(id, {
        id,
        toss,
        p: new Vector3((toss.ndc[0] * h * size.width) / size.height / 2, (toss.ndc[1] * h) / 2, SPAWN_Z),
        v: new Vector3(toss.vx * perPx * 0.5, Math.min(toss.vy * perPx, -MIN_UP), -TO_WALL), // 옆으로 새는 힘은 줄여 벽 쪽으로 곧장 가게
        spin: new Vector3(),
        rest: 0,
      });
      setIds((prev) => [...prev, id]);
      invalidate();
    });
    return () => void off();
  }, [camera, size, invalidate]);

  useFrame((_, raw) => {
    if (!active.size) return;
    const dt = Math.min(0.032, raw);
    const landed: Flight[] = [];
    for (const f of active.values()) {
      f.v.y -= G * dt;
      f.p.addScaledVector(f.v, dt);
      f.spin.x += 3 * dt;
      f.spin.y += 4.5 * dt;

      // 빙 둘러선 서류함 벽(원통)에 부딪힌다 — 벽에서 안쪽을 향하는 법선으로 되튄다
      const r = Math.hypot(f.p.x, f.p.z);
      const limit = wallRadius - 0.5;
      if (r > limit) {
        const nx = -f.p.x / r;
        const nz = -f.p.z / r;
        const dot = f.v.x * nx + f.v.z * nz;
        if (dot < 0) {
          f.v.x -= 2 * dot * nx;
          f.v.z -= 2 * dot * nz;
          f.v.multiplyScalar(WALL_BOUNCE);
          f.p.x = -nx * limit;
          f.p.z = -nz * limit;
          thud(110); // 서랍에 부딪히는 소리
        }
      }

      if (f.p.y <= FLOOR) {
        f.p.y = FLOOR;
        if (Math.abs(f.v.y) > 1.6) {
          f.v.y = -f.v.y * FLOOR_BOUNCE;
          f.v.x *= 0.7;
          f.v.z *= 0.7;
          thud(55);
        } else {
          f.v.set(f.v.x * 0.8, 0, f.v.z * 0.8);
          f.rest += dt;
        }
      }
      if (f.rest > 0.9) landed.push(f);
    }
    if (landed.length) {
      landed.forEach((f) => active.delete(f.id));
      setIds((prev) => prev.filter((id) => active.has(id)));
      landed.forEach((f) => f.toss.onLanded());
    }
    invalidate(); // frameloop="demand" — 날아가는 동안만 계속 그린다
  });

  return (
    <>
      {ids.map((id) => {
        const f = active.get(id);
        return f ? <Floppy key={id} flight={f} /> : null;
      })}
    </>
  );
}
