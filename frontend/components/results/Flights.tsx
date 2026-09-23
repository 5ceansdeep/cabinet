"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import { thud } from "@/lib/thud";
import { FloppyBody, useLabel } from "./floppy";
import { onToss, type Toss } from "./flying";

/* 손을 떠난 디스크 — 중력을 받아 날아가고, 빙 둘러선 서류함 벽(원통)에 부딪혀 튕기고,
   바닥에 떨어져 몇 번 구르다 멎으면 목록에서 빠진다. CabinetWall 의 Canvas 안에서만 쓴다. */

const G = 24; // 중력 (월드 단위/s²) — 높이 솟았다가 묵직하게 떨어진다
const FLOOR = -2.4; // 바닥 높이
const WALL_BOUNCE = 0.55;
const FLOOR_BOUNCE = 0.42;

type Flight = { id: number; toss: Toss; p: Vector3; v: Vector3; spin: Vector3; rest: number; age: number };

// 매 프레임 바뀌는 물리 상태라 리액트 바깥에서 들고 있는다
const active = new Map<number, Flight>();
let nextId = 0;

function Flying({ flight }: { flight: Flight }) {
  const label = useLabel(flight.toss.track);
  const g = useRef<Group>(null!);
  // 물리가 움직인 자리를 매 프레임 물체에 옮겨 준다
  useFrame(() => {
    g.current.position.copy(flight.p);
    g.current.rotation.set(flight.spin.x, flight.spin.y, flight.spin.z);
  });
  return (
    <group ref={g} position={flight.p}>
      <FloppyBody map={label.tex} />
      {/* 제 빛을 내어 어둠 속에서도 보이고, 부딪히는 서랍도 잠깐 밝힌다 */}
      <pointLight position={[0, 0, 0.5]} intensity={4} distance={4} decay={2} color="#e8f4ff" />
    </group>
  );
}

export default function Flights({ wallRadius }: { wallRadius: number }) {
  const { invalidate } = useThree();
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    const off = onToss((toss) => {
      const id = nextId++;
      active.set(id, { id, toss, p: new Vector3(...toss.p), v: new Vector3(...toss.v), spin: new Vector3(), rest: 0, age: 0 });
      setIds((prev) => [...prev, id]);
      invalidate();
    });
    return () => void off();
  }, [invalidate]);

  useFrame((_, raw) => {
    if (!active.size) return;
    const dt = Math.min(0.032, raw);
    const landed: Flight[] = [];
    for (const f of active.values()) {
      f.age += dt;
      f.v.y -= G * dt;
      f.p.addScaledVector(f.v, dt);
      f.spin.x += 3.2 * dt;
      f.spin.y += 4.5 * dt;

      // 서류함 벽(원통)에 부딪힌다 — 벽에서 안쪽을 향하는 법선으로 되튄다
      const r = Math.hypot(f.p.x, f.p.z);
      const limit = wallRadius - 0.6;
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
          f.v.set(f.v.x * 0.6, 0, f.v.z * 0.6); // 바닥 마찰
          f.rest += dt;
        }
      }
      // 멎었거나, 어딘가에 끼여 오래 굴러다니면(안전장치) 거둬들인다
      if (f.rest > 0.5 || f.age > 8) landed.push(f);
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
        return f ? <Flying key={id} flight={f} /> : null;
      })}
    </>
  );
}
