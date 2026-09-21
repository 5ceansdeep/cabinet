"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Object3D, Quaternion, Vector3, type Group } from "three";
import { CABINET, CAMERA, PRESENT, PRESENT_SCALE } from "./dimensions";
import { FOLDER } from "./Drawer";
import { labelMaterial, materials } from "./materials";

const facing = new Object3D();
facing.position.copy(PRESENT);
facing.lookAt(CAMERA); // 떠오른 파일이 카메라를 정면으로 본다
const end = new Vector3();
const ident = new Quaternion();

/* 서랍 속 행잉 폴더 한 장. out 이면 위로 들렸다가 눈앞까지 날아오고, 아니면 제자리로 쏙 들어간다.
   Drawer 의 자식으로 두고, 날아갈 목적지만 월드 좌표에서 서랍 로컬로 바꿔 쓴다. */
export default function FileCard({ slot, out, tab }: { slot: number; out: boolean; tab: string }) {
  const g = useRef<Group>(null!);
  const t = useRef(0);
  const home = useMemo(() => new Vector3(0, -CABINET.H * 0.4 + FOLDER.h / 2 + 0.01, -0.12 - slot * 0.08), [slot]);
  const m = materials();

  useFrame((_, dt) => {
    t.current += ((out ? 1 : 0) - t.current) * (1 - Math.exp(-(out ? 3.5 : 6) * dt));
    if (Math.abs((out ? 1 : 0) - t.current) < 0.002) t.current = out ? 1 : 0;
    const s = t.current * t.current * (3 - 2 * t.current); // smoothstep
    end.copy(PRESENT);
    g.current.parent!.worldToLocal(end);
    // 2차 베지어: 제자리 → 서랍 위로 들어 올림 → 카메라 앞
    const u = 1 - s;
    const liftY = home.y + 1.1;
    g.current.position.set(
      u * u * home.x + s * s * end.x,
      u * u * home.y + 2 * u * s * liftY + s * s * end.y,
      u * u * home.z + 2 * u * s * home.z + s * s * end.z,
    );
    g.current.quaternion.slerpQuaternions(ident, facing.quaternion, s);
    g.current.scale.setScalar(1 + (PRESENT_SCALE - 1) * s);
  });

  return (
    <group ref={g} position={home}>
      <RoundedBox args={[FOLDER.w, FOLDER.h, 0.006]} radius={0.002} smoothness={2} castShadow receiveShadow material={m.manila} />
      {/* 인덱스 탭 */}
      <mesh position={[-FOLDER.w / 2 + 0.22, FOLDER.h / 2 + 0.035, 0]} castShadow material={m.manila}>
        <boxGeometry args={[0.32, 0.07, 0.006]} />
      </mesh>
      <mesh position={[-FOLDER.w / 2 + 0.22, FOLDER.h / 2 + 0.035, 0.0035]} material={labelMaterial(tab, "#d9c28f")}>
        <planeGeometry args={[0.3, 0.065]} />
      </mesh>
      {/* 안에 끼운 서류 한 장 */}
      <mesh position={[0, -0.01, 0.0045]} receiveShadow material={m.paper}>
        <planeGeometry args={[FOLDER.w - 0.08, FOLDER.h - 0.06]} />
      </mesh>
    </group>
  );
}
