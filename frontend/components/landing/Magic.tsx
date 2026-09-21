"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  type Group,
  type InstancedMesh,
  type Mesh,
  type PointLight,
} from "three";

/* 2번 로딩 — 서랍 속에서 마법이 일어난다. 빛기둥과 후광, 도는 문양 고리, 나선으로 떠오르는 금빛 조각,
   떠다니는 시스템 문장. 순백 배경이라 가산 합성 대신 호박색 알파로 보이게 한다. Drawer 의 자식(서랍 로컬 좌표). */

const LINES = [
  "[SYSTEM] 구조적 문장 해석 중...",
  "[EMBEDDING] 음악 메타데이터 매칭 중...",
  "[VECTOR] 768차원 벡터 공간 탐색 중...",
  "[ARCHIVE] 앨범 이미지 색인 중...",
  "[AUDIO] 청음 음원 버퍼링 중...",
];
const GEMS = 70;
const Z = -1.4; // 서랍 앞면에서 안쪽으로 — 마법의 중심

function tex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function build() {
  const glow = tex(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,214,120,.95)");
    g.addColorStop(0.35, "rgba(240,176,56,.45)");
    g.addColorStop(1, "rgba(240,176,56,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
  const beam = tex(4, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255,210,110,0)");
    g.addColorStop(1, "rgba(240,180,70,.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
  });
  const runes = tex(512, 512, (ctx) => {
    ctx.translate(256, 256);
    ctx.strokeStyle = ctx.fillStyle = "rgba(170,112,20,.9)";
    ctx.lineWidth = 3;
    for (const r of [236, 180]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = "34px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const glyphs = [..."✦☽☉✧♄♃♂♀☿✶☾⚹"];
    for (let i = 0; i < 24; i++) {
      ctx.save();
      ctx.rotate((i / 24) * Math.PI * 2);
      ctx.fillText(glyphs[i % glyphs.length], 0, -208);
      ctx.restore();
    }
  });
  const mat = (map: CanvasTexture) => new MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: DoubleSide, opacity: 0, fog: false });
  return {
    halo: mat(glow),
    beam: mat(beam),
    ring: mat(runes),
    ring2: mat(runes),
    texts: LINES.map((line) =>
      mat(
        tex(1024, 96, (ctx) => {
          ctx.fillStyle = "rgba(120,82,14,.9)";
          ctx.font = '600 44px "Courier New", monospace';
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(line, 512, 50);
        }),
      ),
    ),
    gem: new MeshStandardMaterial({ color: "#d9a441", metalness: 1, roughness: 0.2, emissive: "#8a5a10", emissiveIntensity: 0.6, transparent: true, opacity: 0 }),
  };
}

let cache: ReturnType<typeof build> | undefined;
const fx = () => (cache ??= build());
const o = new Object3D();

export default function Magic({ active }: { active: boolean }) {
  const m = fx();
  const amt = useRef(0);
  const root = useRef<Group>(null!);
  const halo = useRef<Mesh>(null!);
  const beam = useRef<Mesh>(null!);
  const ring = useRef<Mesh>(null!);
  const ring2 = useRef<Mesh>(null!);
  const gems = useRef<InstancedMesh>(null!);
  const texts = useRef<Group>(null!);
  const light = useRef<PointLight>(null!);

  useFrame(({ clock }, dt) => {
    amt.current += ((active ? 1 : 0) - amt.current) * (1 - Math.exp(-(active ? 1.5 : 4) * dt));
    const a = amt.current;
    const t = clock.elapsedTime;
    root.current.visible = a > 0.005;
    if (!root.current.visible) return;
    const m = fx(); // 재질 opacity 는 매 프레임 직접 바꾼다

    m.halo.opacity = a * (0.75 + 0.25 * Math.sin(t * 2));
    halo.current.scale.setScalar(2.6 + Math.sin(t * 1.3) * 0.15);
    m.beam.opacity = a * 0.9;
    beam.current.rotation.y = t * 0.2;
    m.ring.opacity = m.ring2.opacity = a * 0.85;
    ring.current.rotation.z = t * 0.4;
    ring2.current.rotation.z = -t * 0.6;
    light.current.intensity = a * 4;

    // 금빛 조각 — 나선을 그리며 떠올랐다가 사라진다
    m.gem.opacity = a;
    for (let i = 0; i < GEMS; i++) {
      const p = (t * 0.15 + i / GEMS) % 1;
      const ang = i * 2.4 + t * 0.8;
      const r = 0.2 + 0.5 * p;
      o.position.set(Math.cos(ang) * r, -0.1 + p * 2.4, Z + Math.sin(ang) * r);
      o.rotation.set(t * 2 + i, t * 3 + i, 0);
      o.scale.setScalar(0.012 + 0.022 * Math.sin(p * Math.PI));
      o.updateMatrix();
      gems.current.setMatrixAt(i, o.matrix);
    }
    gems.current.instanceMatrix.needsUpdate = true;

    // 떠다니는 문장
    texts.current.children.forEach((c, i) => {
      const p = (t * 0.12 + i / LINES.length) % 1;
      c.position.set(Math.sin(i * 1.7 + t * 0.5) * 0.35, 0.1 + p * 2.2, Z + 0.2 + (i % 2) * 0.3);
      m.texts[i].opacity = a * Math.sin(p * Math.PI);
    });
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={halo} position={[0, 1.2, Z - 0.3]} material={m.halo}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={beam} position={[0, 1.1, Z]} material={m.beam}>
        <cylinderGeometry args={[0.8, 0.45, 2.6, 48, 1, true]} />
      </mesh>
      <mesh ref={ring} position={[0, 0.25, Z]} rotation-x={-Math.PI / 2} material={m.ring}>
        <planeGeometry args={[1.6, 1.6]} />
      </mesh>
      <mesh ref={ring2} position={[0, 1.6, Z]} rotation-x={-Math.PI / 2} material={m.ring2}>
        <planeGeometry args={[1.1, 1.1]} />
      </mesh>
      <instancedMesh ref={gems} args={[undefined, m.gem, GEMS]}>
        <octahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <group ref={texts}>
        {m.texts.map((mat, i) => (
          <mesh key={i} material={mat}>
            <planeGeometry args={[1.4, 0.13]} />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position={[0, 0.8, Z]} color="#ffc561" intensity={0} distance={5} />
    </group>
  );
}
