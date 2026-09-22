"use client";

import { useRef, useState, type FormEvent } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { thud } from "@/lib/thud";
import { CABINET, CAMERA, FULL_OPEN, INNER_HALF, LOOK, CARD_VH, PRESENT_TOP, drawerY } from "./dimensions";
import Drawer from "./Drawer";
import FileCard from "./FileCard";
import { materials } from "./materials";

export type Field = { name: string; type: string; label: string };
export type Phase = "auth" | "loading";

const { W, H, D, T } = CABINET;

/* 고정 키 라이트 — 왼쪽 위 앞에서 비춰 서랍 틈과 바닥에 부드러운 그림자 */
function KeyLight() {
  return (
    <spotLight
      castShadow
      position={[-3, 5, 7]}
      angle={0.6}
      penumbra={1}
      intensity={110}
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0003}
    />
  );
}

/* 카메라는 서랍 정면에 고정 */
function Rig() {
  useFrame(({ camera }) => camera.lookAt(LOOK));
  return null;
}

function Carcass() {
  const m = materials();
  const outer = INNER_HALF + T / 2;
  const panel = (pos: [number, number, number], size: [number, number, number], key: string) => (
    <RoundedBox key={key} args={size} radius={0.012} smoothness={3} position={pos} castShadow receiveShadow material={m.steel} />
  );
  return (
    <>
      {panel([0, outer, 0], [W + 2 * T, T, D], "top")}
      {panel([0, -outer, 0], [W + 2 * T, T, D], "bottom")}
      {panel([-(W + T) / 2, 0, 0], [T, 2 * INNER_HALF + 2 * T, D], "left")}
      {panel([(W + T) / 2, 0, 0], [T, 2 * INNER_HALF + 2 * T, D], "right")}
      {panel([0, 0, -D / 2 + T / 2], [W, 2 * INNER_HALF, T], "back")}
      {[-1, 1].map((s) => panel([0, (s * (H + CABINET.GAP)) / 2, 0], [W, 0.02, D], `div${s}`))}
      {/* 잠금 실린더 */}
      <mesh position={[W / 2 - 0.12, outer, D / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]} material={m.metal}>
        <cylinderGeometry args={[0.022, 0.022, 0.02, 24]} />
      </mesh>
      {/* 받침 */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 0.05), -outer - T / 2 - 0.02, sz * (D / 2 - 0.08)]} material={m.dark}>
            <boxGeometry args={[0.08, 0.04, 0.08]} />
          </mesh>
        )),
      )}
    </>
  );
}

/* 1·2번 — 순백의 공간 저 멀리, 정면에서 바라본 서류함. 맨 위 서랍이 톡톡 들썩이며 부르고, 호버하면 쫙 펼쳐지고,
   파일이 한 장씩 날아와 입력을 받는다. fields 순서대로 진행 후 onDone(values) */
export default function CabinetScene({ fields, phase, onDone }: { fields: Field[]; phase: Phase; onDone: (values: Record<string, string>) => void }) {
  const [open, setOpen] = useState(false); // 한 번 호버하면 열린 채로 유지
  const [step, setStep] = useState(0);
  const values = useRef<Record<string, string>>({});

  function submit(e: FormEvent<HTMLFormElement>, name: string) {
    e.preventDefault();
    values.current[name] = String(new FormData(e.currentTarget).get(name));
    thud(140);
    const next = step + 1;
    setStep(next);
    if (next < fields.length) return;
    // 마지막 파일이 제자리로 들어가면 로딩 시작 — 서랍이 닫힌다
    setTimeout(() => onDone(values.current), 700);
  }

  // 로딩이 시작되면 서랍이 쾅 닫히고, 그다음 후광이 비친다
  const slide = phase === "auth" && open ? FULL_OPEN : 0;
  const inputCls =
    "border-b border-black/20 bg-transparent py-1 text-center font-mono text-black/80 outline-none placeholder:text-black/30 focus:border-black/50";

  return (
    <>
      <Canvas shadows camera={{ position: CAMERA.toArray(), fov: 30 }} dpr={[1, 1.5]} className="absolute! inset-0">
        {/* 배경은 투명 — 로딩 후광(Halo)이 캔버스 뒤에서 서류함을 비춘다. 흰 바탕은 페이지 몫 */}
        <fog attach="fog" args={["#ffffff", 14, 30]} />
        <ambientLight intensity={0.5} />
        {/* 카메라 쪽 보조광 — 눈앞에 떠오른 파일 앞면을 밝힌다 */}
        <directionalLight position={CAMERA.toArray()} intensity={0.8} />
        <KeyLight />
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 5, 5]} scale={[10, 3, 1]} />
          <Lightformer intensity={1} position={[-6, 1, 3]} scale={[3, 8, 1]} />
          <Lightformer intensity={1.2} position={[0, -1, 10]} scale={[8, 4, 1]} />
        </Environment>
        <Rig />

        <group
          onPointerOver={() => {
            if (!open) document.body.style.cursor = "pointer";
            setOpen(true);
          }}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <Carcass />
          <Drawer y={drawerY(0)} slide={slide} label="A — F" knock={!open}>
            {fields.map((f, i) => (
              <FileCard key={f.name} slot={i} out={open && i === step} tab={f.label} />
            ))}
          </Drawer>
          <Drawer y={drawerY(1)} slide={0} label="G — M" />
          <Drawer y={drawerY(2)} slide={0} label="N — Z" />
        </group>

        <ContactShadows position={[0, -INNER_HALF - T - 0.04, 0]} opacity={0.45} scale={40} resolution={1024} blur={2.2} far={3} />
      </Canvas>

      {/* 입력칸 — 카메라가 고정이라 파일은 늘 같은 화면 자리에 도착한다. 3D Html 대신 DOM 으로 얹어
          매 프레임 계산 없이 즉시 뜨고 바로 입력된다. 파일 크기(세로 화면 비례)에 맞춰 vh 단위 */}
      {open && step < fields.length && (
        <form
          key={step}
          onSubmit={(e) => submit(e, fields[step].name)}
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[appear_.35s_.3s_both]"
          style={{ top: `${PRESENT_TOP}%` }}
        >
          <input
            name={fields[step].name}
            type={fields[step].type}
            required
            autoFocus
            aria-label={fields[step].label}
            placeholder={fields[step].label.toLowerCase()}
            className={inputCls}
            style={{ width: `${CARD_VH * 0.62}vh`, fontSize: `${CARD_VH * 0.038}vh` }}
          />
        </form>
      )}

      {/* 키보드 사용자용 — 포커스하면 서랍이 열린다 */}
      {!open && (
        <button onFocus={() => setOpen(true)} className="sr-only">
          서류함 열기
        </button>
      )}
    </>
  );
}
