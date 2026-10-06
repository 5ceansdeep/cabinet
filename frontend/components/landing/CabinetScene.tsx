"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { damp, useReducedMotion } from "@/lib/motion";
import { ContactShadows, Environment, Lightformer, PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { Color, type AmbientLight, type DirectionalLight, type Fog, type SpotLight } from "three";
import { bark } from "@/lib/bark";
import { keepContext } from "@/lib/gl";
import { thud } from "@/lib/thud";
import { cut, isMuted, speak, subscribeMuted, warm } from "@/lib/voice";
import { CABINET, CAMERA, FOV, FULL_OPEN, INNER_HALF, LOOK, cardVh, drawerY, fovFor, presentTop } from "./dimensions";
import Drawer from "./Drawer";
import FileCard from "./FileCard";
import Subtitle, { LINE_PACE, subtitleDelays, subtitleLines } from "./Subtitle";
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
  const reduce = useReducedMotion();
  useFrame(({ scene, invalidate }, dt) => {
    const goal = dim ? 1 : 0;
    d.current += (goal - d.current) * damp(1.5, dt, reduce);
    if (Math.abs(goal - d.current) < 0.001) d.current = goal;
    else invalidate();
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


const noop = () => () => {}; // 바뀌지 않는 값 구독용

/* 지금 화면의 카메라 화각 — 세로 화면(폰)이면 넓어진다(dimensions.ts fovFor). 세로일 땐 영화 프레임이 창 전체라 창 비율이 곧 프레임 비율.
   캔버스 밖의 DOM(입력칸·후광)도 같은 값으로 자리를 잡는다 */
const onResize = (cb: () => void) => {
  addEventListener("resize", cb);
  return () => removeEventListener("resize", cb);
};
export const useFov = () => useSyncExternalStore(onResize, () => fovFor(innerWidth / innerHeight), () => FOV);

/* 카메라는 서랍 정면에 고정 — 한 번만 맞춘다(매 프레임 lookAt 할 필요 없다) */
function Rig() {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    camera.lookAt(LOOK);
    invalidate();
  }, [camera, invalidate]);
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
  drawer,
  locked = false,
  intro,
  phase,
  flow,
  onClearFlow,
  onCheck,
  onDone,
}: {
  fields: Field[];
  drawer: number; // 이 페이지가 쓰는 서랍 (0 맨 위, 1 가운데, 2 맨 아래)
  locked?: boolean; // 이미 등록된 사람 — 인사만 하고 지나가니 서랍이 열리지 않는다
  intro: Line; // 서랍을 열기 전 첫 대사 — 페이지마다 다르다
  phase: Phase;
  flow: Line | null;
  onClearFlow: () => void;
  onCheck?: (name: string, value: string) => Promise<Line | Field[] | null>; // 칸마다 서버에 물어볼 게 있으면 — 꾸지람 대사, 이제부터 받을 서류 목록(갈래가 정해짐), 괜찮으면 null
  onDone: (values: Record<string, string>) => Promise<number | null>;
}) {
  const [open, setOpen] = useState(false); // 한 번 호버하면 열린 채로 유지
  const [step, setStep] = useState(0);
  const [landed, setLanded] = useState(-1); // 눈앞에 도착한 파일 번호 — 입력칸은 파일이 도착한 뒤에 뜬다
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

  // 로딩이 시작되면 손가락 커서도 되돌린다
  useEffect(() => {
    if (phase !== "auth") document.body.style.cursor = "";
  }, [phase]);

  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false); // 브라우저가 소리를 막고 있나
  // 자막 띠 — 서버 렌더에는 document 가 없으니 브라우저에서만 찾는다
  const subtitleBar = useSyncExternalStore(noop, () => document.getElementById("cinema-sub"), () => null);
  const said = voiced?.line;
  const waving = said?.voiceKey === "SUBMITTING"; // 대조하는 동안 서랍 속 파일이 파도친다

  // "지나가던 개도 맞히겠네" — 말끝에 개가 짖고 지나간다
  useEffect(() => {
    if (said?.voiceKey !== "PASSWORD_SIGNUP.invalid") return;
    const id = setTimeout(() => bark(), 1800);
    return () => clearTimeout(id);
  }, [said?.voiceKey, voiced?.n]);
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
    if (e.key === "Escape") back();
  }

  // 앞 서류로 돌아가 고쳐 쓴다 — ESC, 또는 입력칸 아래 글을 누른다(폰)
  function back() {
    if (step === 0) return;
    setError((p) => ({ line: null, n: p.n }));
    onClearFlow();
    touch();
    setStep(step - 1);
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
    // 형식은 맞다 — 서버에 물어봐야 아는 것(이미 가입된 이메일 등)은 이 칸에서 바로
    const checked = await onCheck?.(field.name, v);
    const list = Array.isArray(checked) ? checked : fields; // 갈래가 막 정해졌으면 새 목록으로 — 이 렌더의 fields 는 아직 옛것
    const refused = Array.isArray(checked) ? null : checked;
    if (refused) {
      setError((p) => ({ line: refused, n: p.n + 1 }));
      input.focus();
      return;
    }
    setError((p) => ({ line: null, n: p.n }));
    const all = { ...values, [field.name]: v };
    setValues(all);
    thud(140);
    const next = step + 1;
    setStep(next);
    if (next < list.length) return;
    // 파일이 제자리로 들어가는 동안 대조 — 실패하면 해당 파일이 다시 날아온다
    const back = await onDone(all);
    if (back !== null) setStep(back);
  }

  // 로딩이 시작되면 서랍이 쾅 닫히고, 그다음 후광이 비친다
  // 후광이 비치는 동안(로딩)엔 서랍이 닫혀 있고 아무 반응도 하지 않는다 — 들썩임·파일·호버·커서 전부 잠금
  const slide = phase === "auth" && open ? FULL_OPEN : 0;
  const fov = useFov();
  const inputCls =
    "border-b-2 border-black/20 bg-transparent py-1 text-center font-mono text-black/85 outline-none placeholder:text-black/60 focus:border-black/70";

  return (
    <>
      <Canvas
        // "percentage" — 지금 three 버전엔 PCFSoft 가 없어 어차피 이걸로 떨어진다. 기본값(soft)으로 두면 렌더마다 경고가 찍힌다
        shadows="percentage"
        dpr={[1, 1.5]}
        frameloop="demand" // 움직일 때만 그린다 — 서랍·카드·조명이 멎으면 장면이 쉰다(디자인 규칙)
        className="absolute! inset-0"
        onCreated={keepContext}
      >
        {/* 배경은 투명 — 로딩 후광(Halo)이 캔버스 뒤에서 서류함을 비춘다. 흰 바탕은 페이지 몫 */}
        <fog attach="fog" args={["#ffffff", 14, 30]} />
        <Lights dim={phase === "loading"} />
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 5, 5]} scale={[10, 3, 1]} />
          <Lightformer intensity={1} position={[-6, 1, 3]} scale={[3, 8, 1]} />
          <Lightformer intensity={1.2} position={[0, -1, 10]} scale={[8, 4, 1]} />
        </Environment>
        {/* 화각이 화면 비율을 따라 바뀐다(세로 화면) — Canvas 의 camera 는 처음 한 번만 먹어서 따로 둔다 */}
        <PerspectiveCamera makeDefault position={CAMERA.toArray()} fov={fov} />
        <Rig />

        <group
          // 후광이 비칠 때(로딩)와 재방문 인사 중에는 서랍을 잠근다
          onPointerOver={() => {
            if (phase !== "auth" || locked) return;
            if (!open) document.body.style.cursor = "pointer";
            setOpen(true);
          }}
          onPointerOut={() => (document.body.style.cursor = "")}
          // 터치엔 호버가 없다 — 누르면 열린다
          onPointerDown={() => phase === "auth" && !locked && setOpen(true)}
        >
          <Carcass />
          {["A-F", "G-M", "N-Z"].map((label, i) =>
            i === drawer ? (
              <Drawer key={label} y={drawerY(i)} slide={slide} label={label} knock={!open && phase === "auth" && !locked} wave={waving}>
                {fields.map((f, j) => (
                  <FileCard key={f.name} slot={j} out={open && phase === "auth" && j === step} tab={f.label} onArrive={() => setLanded(j)} onLeave={() => setLanded((l) => (l === j ? -1 : l))} />
                ))}
              </Drawer>
            ) : (
              <Drawer key={label} y={drawerY(i)} slide={0} label={label} />
            ),
          )}
        </group>

        <ContactShadows position={[0, -INNER_HALF - T - 0.04, 0]} opacity={0.45} scale={40} resolution={1024} blur={2.2} far={3} />
      </Canvas>

      {/* 입력칸 — 카메라가 고정이라 파일은 늘 같은 화면 자리에 도착한다. 3D Html 대신 DOM 으로 얹어
          매 프레임 계산 없이 즉시 뜨고 바로 입력된다. 파일 크기(세로 화면 비례)에 맞춰 vh 단위 */}
      {open && field && phase === "auth" && landed === step && (
        <form
          key={step}
          noValidate
          onSubmit={submit}
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[appear_.3s_both]"
          style={{ top: `${presentTop(fov)}%` }}
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
            enterKeyHint="next" // 폰 키보드의 엔터 자리에 "다음"
            placeholder={field.label.toLowerCase()}
            className={inputCls}
            // 폰은 파일이 작게 뜬다(세워도 눕혀도) — 글자가 16px 아래면 아이폰이 입력칸으로 화면을 확대해 버린다
            style={{ width: `${cardVh(fov) * 0.62}cqh`, fontSize: `max(16px, ${cardVh(fov) * 0.038}cqh)` }}
          />
          {/* 넘기기 — 엔터만으로는 폰에서 끝을 알기 어려웠다(10/6 사용자). 입력칸 오른쪽에 화살표, 누르면 엔터와 같다 */}
          <button
            type="submit"
            aria-label={LINES.nextLabel}
            className="absolute top-1/2 left-full ml-3 grid size-11 -translate-y-1/2 place-items-center rounded-ui border border-black/15 bg-white/80 text-black/70 transition-colors hover:bg-white hover:text-black active:scale-[.96]"
          >
            <ArrowRight aria-hidden size={18} weight="bold" />
          </button>
          {step > 0 && (
            <button type="button" onClick={back} className="absolute inset-x-0 top-full mt-1 py-2 text-center font-mono text-xs tracking-[.15em] text-black/60">
              <span className="pointer-coarse:hidden">{LINES.escKey} </span>
              {LINES.escHint}
            </button>
          )}
        </form>
      )}

      {/* 소리가 막혀 있으면 — 클릭 한 번이면 풀린다는 안내 */}
      {muted && phase === "auth" && (
        <p className="pointer-events-none absolute inset-x-0 top-8 z-50 px-6 text-center portrait:top-16 font-letter text-sm tracking-wide text-black/65 animate-[appear_.3s_both]">
          {LINES.soundHint}
        </p>
      )}

      {/* 자막은 영화처럼 프레임 아래 검은 띠(layout 의 #cinema-sub)에 — 새 줄이 위에 들어오면 먼저 나온 줄은 아래로 밀린다 */}
      {said &&
        subtitleBar &&
        createPortal(
          <div key={`subtitle-${voiced.n}`} aria-live="polite" className="text-center">
            <Subtitle
              timeline={timeline}
              link={said.link}
              linkDelay={timeline.at(-1)![1] + timeline.at(-1)![0].length * LINE_PACE} // 마지막 줄을 읽고 나서
            />
          </div>,
          subtitleBar,
        )}

      {/* 키보드 사용자용 — 포커스하면 서랍이 열린다 */}
      {!open && phase === "auth" && !locked && (
        <button type="button" onFocus={() => setOpen(true)} className="sr-only">
          서류함 열기
        </button>
      )}
    </>
  );
}
