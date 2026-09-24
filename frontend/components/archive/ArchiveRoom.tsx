"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Vector3, type Group } from "three";
import { CABINET } from "@/components/landing/dimensions";
import { labelMaterial, materials } from "@/components/landing/materials";
import { Wall } from "@/components/results/CabinetWall";
import { FloppyBody, useLabel } from "@/components/results/floppy";
import type { Track } from "@/components/results/tracks";
import { thud } from "@/lib/thud";
import { parseShelves, shelvesRaw, subscribeShelves } from "./shelf";

/* 5번 아카이빙 메인 룸 — 나만의 서류함. 서랍 전면에 감정 테마 태그가 네임택으로 붙어 있고,
   서랍을 누르면 앞으로 열리며 카메라가 위로 올라가 안을 내려다본다(Top-down).
   모은 플로피가 종이 파일 사이에 가지런히 꽂혀 있다. 방(둘러선 벽)은 4번과 같은 것을 쓴다 */

const { W, H, D, T, GAP } = CABINET;
const OPEN = 1.5; // 서랍이 빠지는 거리
const FRONT = new Vector3(0, 0, 3.2); // 서류함을 정면에서
const LOOK_FRONT = new Vector3(0, 0, 0);
const TOP = new Vector3(0, 2.3, 2.1); // 열린 서랍을 내려다보는 자리
const v = new Vector3();

/* 카메라 — 서랍을 열면 위로 올라가 안을 내려다본다 */
function Rig({ open, drawerY }: { open: boolean; drawerY: number }) {
  const look = useRef(LOOK_FRONT.clone());
  useFrame(({ camera, invalidate }, dt) => {
    const k = 1 - Math.exp(-3 * dt);
    const to = open ? v.set(0, TOP.y, TOP.z) : v.copy(FRONT);
    const at = open ? new Vector3(0, drawerY, D / 2 + OPEN - 0.4) : LOOK_FRONT;
    if (camera.position.distanceTo(to) > 0.002 || look.current.distanceTo(at) > 0.002) {
      camera.position.lerp(to, k);
      look.current.lerp(at, k);
      camera.lookAt(look.current);
      invalidate();
    }
  });
  return null;
}

/* 서랍 속에 꽂힌 플로피 한 장 — 종이 파일에 기대어 비스듬히 선다 */
function Filed({ track, x, onOpen }: { track: Track; x: number; onOpen: () => void }) {
  const label = useLabel(track);
  const [hover, setHover] = useState(false);
  return (
    <group
      position={[x, hover ? 0.12 : 0, 0]}
      rotation={[-0.35, 0, 0]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <group scale={0.42}>
        <FloppyBody map={label.tex} />
      </group>
    </group>
  );
}

/* 서류함 몸통 — 재료(절차적 텍스처)는 캔버스 안에서만 만든다. 바깥에서 부르면 서버 렌더에서 터진다 */
function Carcass() {
  const pitch = H + GAP;
  return (
    <mesh position={[0, 0, -0.1]} material={materials().dark}>
      <boxGeometry args={[W + 2 * T, 3 * pitch + 2 * T, D]} />
    </mesh>
  );
}

function Drawer({
  y,
  tag,
  kept,
  open,
  fresh,
  onToggle,
  onOpenTrack,
}: {
  y: number;
  tag: string;
  kept: Track[];
  open: boolean;
  fresh?: boolean; // 방금 저장한 서랍 — 살짝 앞으로 나와 눈에 띈다
  onToggle: () => void;
  onOpenTrack: (t: Track) => void;
}) {
  const g = useRef<Group>(null!);
  const m = materials();
  useFrame(({ invalidate }, dt) => {
    const to = open ? OPEN : fresh ? 0.18 : 0;
    const z = D / 2 - 0.02 + to;
    if (Math.abs(g.current.position.z - z) > 0.001) {
      g.current.position.z += (z - g.current.position.z) * (1 - Math.exp(-6 * dt));
      invalidate();
    }
  });

  return (
    <group ref={g} position={[0, y, D / 2 - 0.02]} onClick={onToggle}>
      {/* 전면 + 네임택(감정 테마 태그) + 손잡이 */}
      <RoundedBox args={[W - 0.04, H, 0.05]} radius={0.012} smoothness={3} material={m.steel} />
      <RoundedBox args={[0.5, 0.14, 0.012]} radius={0.004} position={[0, H * 0.27, 0.03]} material={m.metal} />
      <mesh position={[0, H * 0.27, 0.037]} material={labelMaterial(tag)}>
        <planeGeometry args={[0.44, 0.1]} />
      </mesh>
      <RoundedBox args={[0.46, 0.05, 0.06]} radius={0.02} smoothness={4} position={[0, -H * 0.24, 0.05]} material={m.metal} />

      {/* 몸통 — 열렸을 때 안이 보인다 */}
      <mesh position={[0, -H * 0.4, -D / 2]} material={m.steel}>
        <boxGeometry args={[W - 0.16, 0.02, D]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.08), -0.05, -D / 2]} material={m.steel}>
          <boxGeometry args={[0.02, H * 0.7, D]} />
        </mesh>
      ))}

      {/* 종이 파일 사이에 꽂힌 플로피들 */}
      {open && (
        <group position={[0, -H * 0.12, -D * 0.35]}>
          {kept.map((t, i) => {
            const x = (i - (kept.length - 1) / 2) * 0.34;
            return (
              <group key={t.id}>
                {/* 앞뒤로 받쳐 주는 종이 파일 */}
                <mesh position={[x - 0.17, -0.02, -0.02]} rotation={[-0.35, 0, 0]} material={m.manila}>
                  <planeGeometry args={[0.3, 0.42]} />
                </mesh>
                <Filed track={t} x={x} onOpen={() => onOpenTrack(t)} />
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
}

export default function ArchiveRoom({ fresh }: { fresh: string | null }) {
  const [open, setOpen] = useState<number | null>(null);
  const router = useRouter();
  const raw = useSyncExternalStore(subscribeShelves, shelvesRaw, () => "");
  const shelves = useMemo(() => parseShelves(raw), [raw]);
  const pitch = H + GAP;
  const drawerY = (i: number) => (1 - i) * pitch;

  return (
    <main data-theme="void" className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-background text-foreground">
      <div className="fixed inset-0">
        <Canvas frameloop="demand" camera={{ position: FRONT.toArray(), fov: 55 }} dpr={[1, 1.5]}>
          <color attach="background" args={["#000000"]} />
          <fog attach="fog" args={["#000000", 7, 14]} />
          <ambientLight intensity={0.12} />
          <pointLight position={[0, 0.6, 2.4]} intensity={12} distance={9} decay={2} color="#ffffff" />
          <pointLight position={[0, 2.2, 1.6]} intensity={8} distance={7} decay={2} color="#cfe6f5" />
          <Wall />
          <Rig open={open !== null} drawerY={open === null ? 0 : drawerY(open)} />

          <Carcass />
          {shelves.slice(0, 3).map((s, i) => (
            <Drawer
              key={s.id}
              y={drawerY(i)}
              tag={s.tag}
              kept={s.kept}
              open={open === i}
              fresh={s.id === fresh}
              onToggle={() => {
                thud(open === i ? 60 : 120);
                setOpen(open === i ? null : i);
              }}
              onOpenTrack={(t) => router.push(`/report/${t.id}`)}
            />
          ))}
        </Canvas>
        {/* 위아래는 어둠에 잠긴다 */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(#000_3%,rgba(0,0,0,.7)_16%,transparent_36%,transparent_64%,rgba(0,0,0,.75)_84%,#000_97%)]" />
      </div>

      <header className="pointer-events-none relative flex items-start justify-between gap-4 px-6 pt-6 font-mono text-[10px] tracking-[.2em] text-foreground/50">
        <p>MY CABINET — 건져 올린 것들</p>
        <Link href="/search" className="pointer-events-auto text-accent/80 hover:text-accent">
          NEW REQUEST
        </Link>
      </header>

      <div className="flex-1" />

      <footer className="relative px-6 pb-8 text-center font-mono text-[10px] tracking-[.2em] text-foreground/40">
        {open === null ? "CLICK A DRAWER TO OPEN" : `${shelves[open].tag} — ${shelves[open].kept.length}장 · CLICK A DISK FOR ITS REPORT`}
      </footer>
    </main>
  );
}

