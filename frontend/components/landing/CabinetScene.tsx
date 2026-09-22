"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { Color, type AmbientLight, type DirectionalLight, type Fog, type SpotLight } from "three";
import { thud } from "@/lib/thud";
import { cut, speak, warm } from "@/lib/voice";
import { CABINET, CAMERA, FULL_OPEN, INNER_HALF, LOOK, CARD_VH, PRESENT_TOP, drawerY } from "./dimensions";
import Drawer from "./Drawer";
import FileCard from "./FileCard";
import Subtitle from "./Subtitle";
import { LINES, STALE_MS, type Line } from "./lines";
import { materials } from "./materials";

// 입력 규칙 + 상황별 자막 문구 (문구 내용은 lines.ts)
export type Field = {
  name: string;
  type: string;
  label: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  matches?: string; // 이 이름의 필드 값과 같아야 한다 (비밀번호 확인)
  voiceKey: string; // 음성 파일 묶음 — {voiceKey}.{prompt|missing|invalid|...}.mp3
  promptKey?: string; // prompt 만 다른 파일을 쓸 때
  prompt: string;
  missing: string;
  invalid?: string;
  tooShort?: string;
  mismatch?: string;
};
export type Phase = "auth" | "loading";

const { W, H, D, T } = CABINET;
const WHITE = new Color("#ffffff");
const DARK = new Color("#0b0d12");

/* 조명 — 고정 키 라이트(왼쪽 위 앞) + 카메라 쪽 보조광 + 은은한 주변광.
   dim 이면(후광이 비칠 때) 방이 어두워져 서류함은 뒤에서 오는 빛에 실루엣이 된다 */
function Lights({ dim }: { dim: boolean }) {
  const amb = useRef<AmbientLight>(null!);
  const fill = useRef<DirectionalLight>(null!);
  const key = useRef<SpotLight>(null!);
  const d = useRef(0);
  useFrame(({ scene }, dt) => {
    d.current += ((dim ? 1 : 0) - d.current) * (1 - Math.exp(-1.5 * dt));
    const l = 1 - 0.85 * d.current;
    amb.current.intensity = 0.5 * l;
    fill.current.intensity = 0.8 * l;
    key.current.intensity = 110 * l;
    scene.environmentIntensity = l;
    (scene.fog as Fog).color.lerpColors(WHITE, DARK, d.current);
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.5} />
      {/* 카메라 쪽 보조광 — 눈앞에 떠오른 파일 앞면을 밝힌다 */}
      <directionalLight ref={fill} position={CAMERA.toArray()} intensity={0.8} />
      <spotLight
        ref={key}
        castShadow
        position={[-3, 5, 7]}
        angle={0.6}
        penumbra={1}
        intensity={110}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0003}
      />
    </>
  );
}

/* 긴 자막은 영화처럼 문장마다 줄을 나눈다 ("- 첫 문장" / "- 다음 문장"). "땡." 같은 짧은 조각은 다음 문장에 붙인다 */
function subtitleLines(text: string) {
  if (text.length <= 18) return [text];
  const parts = text.match(/[^.?!]+[.?!]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  return parts.reduce<string[]>((out, s) => {
    const last = out.at(-1);
    if (last && last.length < 6) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
    return out;
  }, []);
}

/* 줄마다 뜨는 시각(초). 음성 파일이 있으면 그 파일에서 찾은 문장 시작 시각에 맞추고(cues — 문장 수가 줄 수와 같을 때),
   없으면 앞 줄을 읽을 만큼 글자 수에 비례해 기다린다 */
const LINE_PACE = 0.09; // 글자당 초
function subtitleDelays(text: string, cues?: number[]) {
  const lines = subtitleLines(text);
  if (cues?.length === lines.length) return lines.map((l, i): [string, number] => [l, Math.max(0, cues[i])]);
  let chars = 0;
  return lines.map((l): [string, number] => {
    const delay = chars * LINE_PACE;
    chars += l.length;
    return [l, delay];
  });
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
   파일이 한 장씩 날아와 입력을 받는다. 다 받으면 onDone(values) — 실패면 다시 받을 파일 번호, 성공이면 null.
   flow 는 부모가 건네는 흐름 자막(대조 중·실패·환영 등)으로 필드 자막보다 앞선다 */
export default function CabinetScene({
  fields,
  intro,
  phase,
  flow,
  onClearFlow,
  onDone,
}: {
  fields: Field[];
  intro: Line; // 서랍을 열기 전 첫 대사 — 페이지마다 다르다
  phase: Phase;
  flow: Line | null;
  onClearFlow: () => void;
  onDone: (values: Record<string, string>) => Promise<number | null>;
}) {
  const [open, setOpen] = useState(false); // 한 번 호버하면 열린 채로 유지
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({}); // 받은 값 — 되돌아오면 입력칸에 다시 채운다
  const [error, setError] = useState<{ line: Line | null; n: number }>({ line: null, n: 0 }); // n — 같은 꾸지람도 다시 들리게
  const [caps, setCaps] = useState(false);
  const [stale, setStale] = useState(false);
  const [activity, setActivity] = useState(0); // 입력할 때마다 올려 재촉 타이머를 다시 잰다
  const prompted = useRef(new Set<string>()); // 이미 읽어 준 안내 대사
  const [voiced, setVoiced] = useState<{ line: Line; delays: number[] | null; n: number } | null>(null); // 지금 들리는 대사와 자막 줄 시각

  // 영화 자막처럼 한 줄 — 대기·안내·꾸지람·재촉. 흐름 자막이 있으면 그게 먼저
  const field = fields[step];
  const fieldLine: Line | null = !open
    ? intro
    : !field
      ? null
      : caps && field.type === "password"
        ? LINES.capsLock
        : (error.line ?? (stale ? LINES.stale : { text: field.prompt, voiceKey: field.promptKey ?? `${field.voiceKey}.prompt` }));
  const shown = flow ?? (phase === "auth" ? fieldLine : null);
  // 대사는 끊기지 않고 차례로 (엔터만 예외 — submit 에서 cut) — 자막은 그 대사의 소리가 시작될 때 함께 바뀐다
  useEffect(() => {
    if (!shown) return;
    const line = shown;
    const lines = subtitleLines(line.text).length;
    // 안내(prompt)는 한 번만 읽는다 — 재촉·Caps Lock·꾸지람 뒤 안내로 돌아올 땐 자막만 바꾼다
    if (line.voiceKey?.endsWith(".prompt") && prompted.current.has(line.voiceKey)) {
      setVoiced((p) => ({ line, delays: null, n: (p?.n ?? 0) + 1 }));
      return;
    }
    if (line.voiceKey?.endsWith(".prompt")) prompted.current.add(line.voiceKey);
    speak(line.voice ?? line.text, line.voiceKey, lines, (delays) => setVoiced((p) => ({ line, delays, n: (p?.n ?? 0) + 1 })));
  }, [shown?.text, error.n]); // eslint-disable-line react-hooks/exhaustive-deps
  // 이 페이지에서 나올 대사들을 첫 대사부터 하나씩 미리 받아 분석해 둔다 — 한꺼번에 받으면 첫 대사가 늦어진다
  useEffect(() => {
    const kinds = ["prompt", "missing", "invalid", "tooShort", "mismatch"] as const;
    const upcoming: Line[] = [
      intro,
      ...fields.flatMap((f) =>
        kinds.filter((k) => f[k]).map((k) => ({ text: f[k]!, voiceKey: k === "prompt" ? (f.promptKey ?? `${f.voiceKey}.prompt`) : `${f.voiceKey}.${k}` })),
      ),
      ...Object.values(LINES as Record<string, unknown>).filter((l): l is Line => typeof l === "object" && l !== null && "text" in l),
      LINES.welcomeBack("자네"),
      LINES.welcomeNew("자네"),
      LINES.returning("자네"),
    ];
    let chain: Promise<unknown> = Promise.resolve();
    for (const l of upcoming) if (l.voiceKey) chain = chain.then(() => warm(l.voiceKey!, subtitleLines(l.text).length));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const said = voiced?.line;
  const timeline = said ? subtitleDelays(said.text, voiced.delays ?? undefined) : [];

  // 한참 손을 놓고 있으면 재촉
  useEffect(() => {
    if (!open || !field) return;
    const id = setTimeout(() => setStale(true), STALE_MS);
    return () => clearTimeout(id);
  }, [open, field, activity]);

  function touch() {
    setStale(false);
    setActivity((n) => n + 1);
  }

  function keys(e: KeyboardEvent<HTMLInputElement>) {
    if (e.getModifierState("CapsLock") !== caps) setCaps(!caps);
    // ESC — 앞 서류로 돌아가 고쳐 쓴다
    if (e.key === "Escape" && step > 0) {
      setError((p) => ({ line: null, n: p.n }));
      onClearFlow();
      touch();
      setStep(step - 1);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // 엔터를 치면 하던 대사와 자막은 그 자리에서 끊고, 다음 대사(다음 안내·꾸지람·대조 중)를 바로 튼다
    cut();
    setVoiced(null);
    onClearFlow();
    touch();
    // 브라우저 기본 경고("이 입력란을 작성하세요") 대신 자막과 목소리로
    const input = e.currentTarget.elements.namedItem(field.name) as HTMLInputElement;
    const v = input.value;
    // 어떤 꾸지람인지 — 앞에서부터 문구가 있는 첫 종류. 음성 파일은 {voiceKey}.{종류}
    const kinds: ("missing" | "tooShort" | "invalid" | "mismatch")[] = input.validity.valueMissing
      ? ["missing"]
      : field.minLength && v.length < field.minLength
        ? ["tooShort", "invalid", "missing"]
        : input.validity.typeMismatch || input.validity.patternMismatch
          ? ["invalid", "missing"]
          : field.matches && v !== values[field.matches]
            ? ["mismatch", "missing"]
            : [];
    const kind = kinds.find((k) => field[k]);
    if (kind) {
      setError((p) => ({ line: { text: field[kind]!, voiceKey: `${field.voiceKey}.${kind}` }, n: p.n + 1 }));
      input.focus();
      return;
    }
    setError((p) => ({ line: null, n: p.n }));
    const all = { ...values, [field.name]: v };
    setValues(all);
    thud(140);
    const next = step + 1;
    setStep(next);
    if (next < fields.length) return;
    // 파일이 제자리로 들어가는 동안 대조 — 실패하면 해당 파일이 다시 날아온다
    const back = await onDone(all);
    if (back !== null) setStep(back);
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
        <Lights dim={phase === "loading"} />
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 5, 5]} scale={[10, 3, 1]} />
          <Lightformer intensity={1} position={[-6, 1, 3]} scale={[3, 8, 1]} />
          <Lightformer intensity={1.2} position={[0, -1, 10]} scale={[8, 4, 1]} />
        </Environment>
        <Rig />

        <group
          // 후광이 비칠 땐(로딩) 서랍 호버를 잠근다
          onPointerOver={() => {
            if (phase !== "auth") return;
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
      {open && field && phase === "auth" && (
        <form
          key={step}
          noValidate
          onSubmit={submit}
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[appear_.35s_.3s_both]"
          style={{ top: `${PRESENT_TOP}%` }}
        >
          <input
            name={field.name}
            type={field.type}
            required
            minLength={field.minLength}
            maxLength={field.maxLength}
            pattern={field.pattern}
            defaultValue={values[field.name]} // 되돌아오거나 다시 시도할 때 쓴 값 그대로
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={keys}
            onKeyUp={(e) => e.getModifierState("CapsLock") !== caps && setCaps(!caps)}
            onInput={touch}
            aria-label={field.label}
            placeholder={field.label.toLowerCase()}
            className={inputCls}
            style={{ width: `${CARD_VH * 0.62}vh`, fontSize: `${CARD_VH * 0.038}vh` }}
          />
          {step > 0 && (
            <p className="absolute inset-x-0 top-full mt-3 text-center font-mono text-[10px] tracking-[.25em] text-black/30">{LINES.escHint}</p>
          )}
        </form>
      )}

      {said && (
        // 위쪽을 고정 — 새 줄이 위에 들어오면 먼저 나온 줄은 아래로 밀린다. z-50: 3D 장면·입력 파일·후광 빛보다 늘 위
        <div key={`subtitle-${voiced.n}`} aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[74%] z-50 px-6 text-center">
          <Subtitle
            timeline={timeline}
            link={said.link}
            linkDelay={timeline.at(-1)![1] + timeline.at(-1)![0].length * LINE_PACE} // 마지막 줄을 읽고 나서
          />
        </div>
      )}

      {/* 키보드 사용자용 — 포커스하면 서랍이 열린다 */}
      {!open && phase === "auth" && (
        <button onFocus={() => setOpen(true)} className="sr-only">
          서류함 열기
        </button>
      )}
    </>
  );
}
