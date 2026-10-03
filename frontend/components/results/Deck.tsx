"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, type Group, type Mesh } from "three";
import { thud } from "@/lib/thud";
import { damp, reducedMotion, useReducedMotion } from "@/lib/motion";
import { DISK, FloppyBody, useLabel } from "./floppy";
import { MOUTH } from "./SaveDrawer";
import { REVEAL_LEAD, REVEAL_MOUTH } from "./room";
import { tossDisk } from "./flying";
import type { Track } from "./tracks";

/* 꾹 누르는 동안 차오르는 원 게이지 — 캔버스에 호를 그려 디스크 앞에 띄운다 */
function useGauge() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const tex = new CanvasTexture(c);
    const st = { drawn: -1 };
    // 2% 단위로만 다시 그린다 — 누르는 동안 매 프레임 256² 캔버스를 그려 올리지 않게
    const draw = (raw: number) => {
      const p = Math.round(raw * 50) / 50;
      if (p === st.drawn) return;
      st.drawn = p;
      ctx.clearRect(0, 0, 256, 256);
      // 얇은 흰 원 — 바탕은 아주 흐리게, 차오르는 쪽만 또렷하게
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(255,255,255,.15)";
      ctx.beginPath();
      ctx.arc(128, 128, 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(128, 128, 60, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
      tex.needsUpdate = true;
    };
    draw(0);
    return { tex, draw };
  }, []);
}

/* 결과 디스크들 — 전부 3D 덩어리. 가운데 곡이 앞으로 나오고 양옆은 뒤로 물러난다.
   호버하면 들리며 라벨에 점수가 타자기로 찍히고, 잡고 끌면 돌아가고, 위로 홱 뿌리면 손을 떠난다.
   짧게 한 번 누르면 밑의 드라이브 슬롯에 꽂혀 재생되고, 꽂힌 디스크를 누르거나 위로 올리면 빠지며 멈춘다 */

const X0 = -0.9; // 줄 가운데 — 오른쪽 곡 목록 자리만큼 왼쪽으로
const GAP = 1.1; // 디스크 사이 간격 — 10곡이라 6곡 때(1.25)보다 촘촘히
const DEPTH = -2.8; // 가운데 디스크의 깊이
const THROW_SPEED = 0.35; // 이보다 빠르게 위로 뿌리면 던진 것 (px/ms)
const MIN_UP = 12.5; // 살살 뿌려도 이만큼은 솟구친다 (월드 단위/s) — 가파른 포물선
const TO_WALL = 3.8; // 벽 쪽으로 밀어주는 속도 — 앞으로 덜 뻗고 위로 솟게
const HOLD_MS = 900; // 이만큼 가만히 꾹 누르고 있으면 저절로 던져진다
const HOLD_SLOP = 6; // 이만큼(px) 움직이면 꾹 누르기가 아니라 돌리기 — 게이지를 취소한다
const TAP_MS = 300; // 이보다 짧게, 거의 움직이지 않고 떼면 클릭
const SPIN = 0.012; // 끈 1px 이 몇 라디안
const SPIN_DECAY = 3.7; // 놓은 뒤 회전이 잦아드는 빠르기(1/s) — 예전 60Hz 기준 프레임당 0.94 와 같은 손맛, 120Hz 에서도 같게
const SAMPLE_MS = 80; // 손놀림 속도는 최근 이만큼의 이동으로 잰다 — 이벤트 하나로 재면 들쭉날쭉했다
/* 드라이브 — 진짜 플로피 드라이브처럼 앞면에 가로 입구. 화면 아래 어둠에 몸통이 잠기고 입구만 보인다.
   디스크는 드라이브 앞으로 빠르게 와서 눕고(셔터가 안쪽), 입구로 미끄러져 들어간다 */
const FRONT_Z = -2.9; // 드라이브 앞면
const SLOT_Y = -1.5; // 입구 높이 — 화면 아래 끝, 몸통은 어둠 아래로
const DRIVE = { w: 1.3, h: 0.5, d: 1.1 };
const SHOWN = 0.2; // 꽂힌 디스크가 입구 밖으로 남는 몫
const FLAT = -Math.PI / 2; // 눕힌 디스크 — 위가 안쪽(셔터부터 들어간다)
const FRONT: Pose = { x: X0, y: SLOT_Y, z: FRONT_Z + DISK / 2 + 0.04, rx: FLAT, ry: 0 }; // 입구 바로 앞(누운 채)
const IN: Pose = { x: X0, y: SLOT_Y, z: FRONT_Z + DISK * (SHOWN - 0.5), rx: FLAT, ry: 0 }; // 들어간 자리
/* 드라이브 오가기는 시간을 정한 동작으로(10/3 사용자: 들어가고 나오는 모션이 대충이다 — 목표만 쫓아가 경로가 곧고 끝맺음이 흐렸다).
   넣기: 줄에서 입구 앞까지 살짝 위로 호를 그리며 눕고(0.5초) → 입구로 밀려 들어가 찰칵 걸리며 살짝 튕긴다(0.34초).
   빼기: 입구 밖으로 툭 밀려 나오고(0.26초) → 호를 그리며 일어나 줄로(0.5초) */
type Pose = { x: number; y: number; z: number; rx: number; ry: number };
type Stage = "row" | "toFront" | "toIn" | "in" | "toOut" | "toRow";
type Tween = { from: Pose; to: Pose; t0: number; dur: number; lift: number; ease: (t: number) => number; then: Stage };
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2; // 끝에서 살짝 지나쳤다 돌아온다 — 걸쇠에 걸리는 느낌
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const SPAWN: [number, number, number] = [REVEAL_MOUTH[0], REVEAL_MOUTH[1] - 0.1, REVEAL_MOUTH[2] - 0.3]; // 결과 서랍 입구 안쪽

function Disk({
  track,
  offset,
  slot,
  perPx,
  swallow,
  rise,
  onInsert,
  onEject,
  onDiscard,
}: {
  track: Track;
  offset: number; // 가운데에서 몇 칸 떨어졌나
  slot: boolean; // 드라이브에 꽂혀 재생 중
  perPx: number; // 화면 1px 이 이 깊이에서 몇 월드인가
  swallow: number; // 0 이상이면 서랍으로 빨려 든다 — 값은 순서대로 늦어지는 지연(초)
  rise: number; // 생기고 이만큼(초) 뒤 결과 서랍에서 솟아오른다 — 그전엔 서랍 속에 숨어 있다
  onInsert: () => void;
  onEject: () => void;
  onDiscard: () => void;
}) {
  const g = useRef<Group>(null!);
  const label = useLabel(track);
  const spin = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const drag = useRef<{ px: number; py: number } | null>(null);
  const start = useRef({ x: 0, y: 0, t: 0 }); // 누른 자리·때 — 손이 움직이면 꾹 누르기도 클릭도 아니다
  const flick = useRef({ up: 0 });
  const trail = useRef<{ x: number; y: number; t: number }[]>([]); // 최근 손놀림 — 속도(px/ms)를 고르게 잰다
  const typed = useRef(0);
  const sank = useRef(Infinity); // 이 디스크가 빨려 들기 시작하는 시각
  const held = useRef(false); // 꾹 누르고 있나
  const prog = useRef(0); // 게이지 0~1
  const gaugeRef = useRef<Mesh>(null!);
  const gauge = useGauge();
  const [hover, setHover] = useState(false);
  const [thrown, setThrown] = useState(false);
  const stage = useRef<Stage>("row"); // 드라이브로 가는 길 — 줄 → 입구 앞 → 안, 뺄 때는 안 → 입구 밖 → 줄
  const tween = useRef<Tween | null>(null);
  const born = useRef(-1); // 생긴 시각(첫 프레임)
  const { invalidate } = useThree();
  const reduce = useReducedMotion(); // 감속 모드 — 날아오기·꽂기·관성 없이 바로, 던지면 날리지 않고 바로 빠진다
  // 목표가 바뀌면 깨운다 — 멎은 장면은 그리지 않으니(frameloop="demand") 호버·넘기기·꽂기·빨려 들기의 시작을 알려야 한다
  useEffect(() => invalidate(), [hover, slot, offset, swallow, invalidate]);

  /* 손을 떠난다 — 손놀림(vx)이 있으면 그 방향으로, 꾹 눌러 던지면 곧장 위로 */
  function launch(vx: number, vy = MIN_UP) {
    const p = g.current.position;
    held.current = false;
    drag.current = null;
    removeEventListener("pointermove", move);
    setThrown(true);
    thud(150);
    if (reducedMotion()) return onDiscard();
    tossDisk({ track, tex: label.tex, p: [p.x, p.y, p.z], v: [vx, vy, -TO_WALL], onLanded: onDiscard });
  }

  useFrame(({ clock }, dt) => {
    if (thrown) return;
    const o = g.current;
    // 결과 서랍이 빠질 때까지 서랍 속에 숨어 있다가, 차례가 되면 작게 나타나 커지며 줄로 날아간다
    if (born.current < 0) born.current = clock.elapsedTime;
    const hidden = clock.elapsedTime - born.current < rise;
    o.visible = !hidden;
    if (hidden) return invalidate();
    if (o.scale.x < 1 && swallow < 0) o.scale.setScalar(reduce ? 1 : Math.min(1, o.scale.x + dt * 3));
    // 서랍에 넣는 중 — 차례로 아래 서랍 입으로 빨려 들며 눕고 작아진다
    if (swallow >= 0) {
      if (sank.current === Infinity) sank.current = clock.elapsedTime + swallow;
      const eat = clock.elapsedTime >= sank.current;
      const kk = damp(5, dt, reduce);
      if (eat) {
        o.position.x += (MOUTH[0] - o.position.x) * kk;
        o.position.y += (MOUTH[1] - o.position.y) * kk;
        o.position.z += (MOUTH[2] - o.position.z) * kk;
        o.rotation.x += (Math.PI / 2 - o.rotation.x) * kk; // 눕혀서 들어간다
        const want = Math.max(0, 1 - (clock.elapsedTime - sank.current) * 1.4);
        o.scale.setScalar(o.scale.x + (want - o.scale.x) * kk);
      }
      if (!eat || o.scale.x > 0.001) invalidate(); // 다 빨려 들면 쉰다
      return;
    }
    // 꾹 누르는 중 — 게이지가 차오르고, 다 차면 저절로 던져진다
    if (held.current) {
      const p = (prog.current = Math.min(1, prog.current + (dt * 1000) / HOLD_MS));
      gauge.draw(p);
      gaugeRef.current.visible = true;
      gaugeRef.current.scale.setScalar(0.95 + p * 0.08);
      if (p >= 1) launch(0); // 다 찼다 — 저절로 날아간다
      invalidate();
    } else if (gaugeRef.current.visible) {
      gaugeRef.current.visible = false;
      prog.current = 0;
      gauge.draw(0);
    }
    // 드라이브로 — 시간을 정한 동작(위 Tween). 꽂힘이 바뀌면 지금 자세에서 다음 동작을 시작한다
    const now = clock.elapsedTime;
    const rowSlot: Pose = { x: X0 + offset * GAP, y: 0, z: DEPTH - Math.abs(offset) * 0.35, rx: 0, ry: 0 };
    const pose = (): Pose => ({ x: o.position.x, y: o.position.y, z: o.position.z, rx: o.rotation.x, ry: o.rotation.y });
    const go = (to: Pose, dur: number, lift: number, ease: Tween["ease"], then: Stage, as: Stage) => {
      tween.current = { from: pose(), to, t0: now, dur: reduce ? 0 : dur, lift, ease, then };
      stage.current = as;
    };
    if (slot && (stage.current === "row" || stage.current === "toRow")) {
      spin.current.x = spin.current.y = spin.current.vx = spin.current.vy = 0;
      go(FRONT, 0.5, 0.35, easeInOut, "toIn", "toFront");
    }
    if (!slot && (stage.current === "in" || stage.current === "toIn" || stage.current === "toFront")) {
      thud(200); // 툭 — 밀려 나온다
      go({ ...FRONT, z: FRONT.z + 0.08 }, 0.26, 0, easeOut, "toRow", "toOut");
    }
    const tw = tween.current;
    if (tw) {
      const t = tw.dur ? Math.min(1, (now - tw.t0) / tw.dur) : 1;
      const e = tw.ease(t);
      const lin = Math.min(1, Math.max(0, e)); // 호의 높이는 지나침 없이
      o.position.set(lerp(tw.from.x, tw.to.x, e), lerp(tw.from.y, tw.to.y, e) + tw.lift * Math.sin(Math.PI * lin), lerp(tw.from.z, tw.to.z, e));
      o.rotation.set(lerp(tw.from.rx, tw.to.rx, lin), lerp(tw.from.ry, tw.to.ry, lin), 0);
      if (t >= 1) {
        tween.current = null;
        if (tw.then === "toIn") go(IN, 0.34, 0, easeOutBack, "in", "toIn");
        else if (tw.then === "in") {
          stage.current = "in";
          thud(260); // 찰칵 — 걸렸다
        } else if (tw.then === "toRow") go(rowSlot, 0.5, 0.25, easeInOut, "row", "toRow");
        else stage.current = tw.then;
      }
    }
    const st = stage.current;
    const s = spin.current;
    let away = 0;
    if (st === "row" && !tween.current) {
      const target = { x: rowSlot.x, y: hover ? 0.16 : 0, z: rowSlot.z };
      const k = damp(7, dt, reduce);
      o.position.x += (target.x - o.position.x) * k;
      o.position.y += (target.y - o.position.y) * k;
      o.position.z += (target.z - o.position.z) * k;
      away = Math.hypot(target.x - o.position.x, target.y - o.position.y, target.z - o.position.z);
      if (away < 1e-4) o.position.set(target.x, target.y, target.z);
      // 놓은 뒤 관성으로 돌다가 정면으로 복귀(드라이브에서 나온 직후면 누운 데서 일어난다)
      if (!drag.current) {
        // 관성(rad/s)은 시간으로 — 프레임이 잦은 모니터에서 덜 도는 일이 없게
        s.x += (0 - s.x) * k * 0.6 + s.vx * dt;
        s.y += (0 - s.y) * k * 0.6 + s.vy * dt;
        const fade = Math.exp(-SPIN_DECAY * dt);
        s.vx *= fade;
        s.vy *= fade;
        if (Math.abs(s.vx) + Math.abs(s.vy) < 1e-3) s.vx = s.vy = 0;
        if (!s.vx && !s.vy && Math.abs(s.x) + Math.abs(s.y) < 1e-4) s.x = s.y = 0;
      }
      const rx = Math.abs(o.rotation.x - s.x) > 0.3 ? o.rotation.x + (s.x - o.rotation.x) * k : s.x;
      o.rotation.set(rx, s.y, 0);
    }
    // 호버하면 점수가 한 글자씩 찍힌다
    const want = hover ? label.length : 0;
    if (typed.current !== want) {
      typed.current += Math.sign(want - typed.current) * Math.max(1, Math.round(dt * 60));
      typed.current = Math.max(0, Math.min(label.length, typed.current));
      label.draw(typed.current);
    }
    // 아직 움직이는 게 있을 때만 다음 프레임 — 다 멎으면 결과 화면도 쉰다(예전엔 디스크마다 매 프레임 불렀다)
    const settled =
      !tween.current && // 드라이브 오가는 동작 중이면 계속
      away < 1e-4 &&
      o.scale.x >= 1 &&
      typed.current === want &&
      (st !== "row" || (!drag.current && !s.vx && !s.vy && !s.x && !s.y && o.rotation.x === s.x));
    if (!settled) invalidate();
  });

  /* 잡기 — 디스크 밖으로 끌고 나가도 끊기지 않게 창 전체에서 손놀림을 듣는다 */
  function down(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    held.current = !slot; // 꽂힌 디스크는 꾹 눌러도 던져지지 않는다
    prog.current = 0;
    drag.current = { px: e.clientX, py: e.clientY };
    start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    flick.current = { up: 0 };
    trail.current = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
    spin.current.vx = spin.current.vy = 0;
    addEventListener("pointermove", move);
    addEventListener("pointerup", up, { once: true });
  }

  function move(e: PointerEvent) {
    if (!drag.current) return;
    // 움직이기 시작했다 — 돌리는 중이지 꾹 누르는 게 아니다. 게이지를 멈춘다
    if (held.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > HOLD_SLOP) held.current = false;
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    const f = flick.current;
    f.up = dy < 0 ? f.up - dy : 0; // 아래로 방향이 바뀌면 처음부터
    trail.current.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    while (trail.current.length > 2 && e.timeStamp - trail.current[0].t > SAMPLE_MS) trail.current.shift();
    const s = spin.current;
    s.y += dx * SPIN;
    s.x += dy * SPIN;
    drag.current = { px: e.clientX, py: e.clientY };
    invalidate();
  }

  function up(e: PointerEvent) {
    removeEventListener("pointermove", move);
    held.current = false;
    if (!drag.current) return;
    drag.current = null;
    // 짧게 한 번 — 슬롯에 꽂거나(재생), 꽂힌 디스크면 뺀다(멈춤)
    const s0 = start.current;
    if (e.timeStamp - s0.t < TAP_MS && Math.hypot(e.clientX - s0.x, e.clientY - s0.y) < HOLD_SLOP) return slot ? onEject() : onInsert();
    // 손을 뗄 때의 속도(px/ms) — 최근 SAMPLE_MS 동안의 이동으로
    const tr = trail.current;
    const first = tr.find((p) => e.timeStamp - p.t <= SAMPLE_MS) ?? tr[0];
    const span = Math.max(8, e.timeStamp - first.t);
    const vx = (e.clientX - first.x) / span;
    const vy = (e.clientY - first.y) / span;
    const f = flick.current;
    if (vy > -THROW_SPEED || f.up <= 40) {
      // 살살 놓았다 — 그 빠르기로 조금 더 돌다가 제자리로(감속 모드면 바로)
      if (!reducedMotion()) {
        spin.current.vy = vx * 1000 * SPIN;
        spin.current.vx = vy * 1000 * SPIN;
      }
      return invalidate();
    }
    if (slot) return onEject(); // 꽂힌 디스크를 위로 — 빼서 제자리로
    // 화면은 아래가 +y, 3D 는 위가 +y — 부호를 뒤집어 위로 솟구치게 한다
    launch(vx * 1000 * perPx * 0.35, Math.max(-vy * 1000 * perPx, MIN_UP));
  }

  if (thrown) return null; // 이제부터는 Flights 가 그린다

  return (
    <group
      ref={g}
      position={SPAWN} // 결과 서랍 입구 안쪽에서 시작 — 매 렌더 같은 값이라 다시 옮겨지지 않는다
      scale={0.5}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
      onPointerDown={down}
    >
      <FloppyBody map={label.tex} />
      {/* 꾹 누르는 동안 차오르는 원 게이지 */}
      <mesh ref={gaugeRef} position={[0, 0, 0.35]} visible={false}>
        <planeGeometry args={[0.62, 0.62]} />
        <meshBasicMaterial map={gauge.tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* 재생 드라이브 — 앞면에 가로 입구, 옆에 불. 재생 중이면 불이 켜진다 */
function Drive({ on, visible }: { on: boolean; visible: boolean }) {
  const top = SLOT_Y + 0.1; // 입구는 윗면에서 조금 아래
  return (
    <group position={[X0, top - DRIVE.h / 2, FRONT_Z - DRIVE.d / 2]} visible={visible}>
      <RoundedBox args={[DRIVE.w, DRIVE.h, DRIVE.d]} radius={0.03} smoothness={3}>
        <meshStandardMaterial color="#1a1f27" roughness={0.55} metalness={0.45} />
      </RoundedBox>
      {/* 입구 — 검은 틈과 살짝 밝은 테 */}
      <mesh position={[0, DRIVE.h / 2 - 0.1, DRIVE.d / 2 + 0.002]}>
        <planeGeometry args={[DISK + 0.12, 0.085]} />
        <meshStandardMaterial color="#3a414b" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, DRIVE.h / 2 - 0.1, DRIVE.d / 2 + 0.004]}>
        <planeGeometry args={[DISK + 0.06, 0.04]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh position={[DRIVE.w / 2 - 0.12, DRIVE.h / 2 - 0.1, DRIVE.d / 2 + 0.004]}>
        <circleGeometry args={[0.022, 16]} />
        <meshBasicMaterial color={on ? "#00e5ff" : "#3a414b"} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function Deck({
  tracks,
  index,
  playing,
  saving = false,
  onInsert,
  onEject,
  onDiscard,
}: {
  tracks: Track[]; // 늘어선 디스크 (꽂힌 디스크는 빼고)
  index: number;
  playing: Track | null; // 드라이브에 꽂힌 디스크
  saving?: boolean; // 서랍에 넣는 중
  onInsert: (t: Track) => void;
  onEject: () => void;
  onDiscard: (t: Track) => void;
}) {
  const { camera, size } = useThree();
  // 이 깊이에서 화면 1px 이 몇 월드인지 — 던지는 손놀림(px/ms)을 월드 속도로 바꿀 때 쓴다
  const h = 2 * Math.abs(DEPTH) * Math.tan(((camera as unknown as { fov: number }).fov * Math.PI) / 360);
  const perPx = h / size.height;
  // 꽂힌 디스크도 같은 목록에 둔다 — key 가 같아 줄에서 슬롯으로 스르륵 옮겨 간다
  const all = playing ? [...tracks, playing] : tracks;

  return (
    <>
      {all.map((t, i) => (
        <Disk
          key={t.id}
          track={t}
          offset={i - index}
          slot={t === playing}
          perPx={perPx}
          swallow={saving ? i * 0.12 : -1}
          rise={REVEAL_LEAD + i * 0.07}
          onInsert={() => onInsert(t)}
          onEject={onEject}
          onDiscard={() => onDiscard(t)}
        />
      ))}
      <Drive on={!!playing} visible={!saving} />
      {/* 재생 중이면 꽂힌 디스크가 시안 빛을 머금는다 — 조명은 늘 두고 세기만 바꾼다(붙였다 떼면 셰이더를 다시 컴파일해 꽂는 순간 끊겼다) */}
      <pointLight position={[IN.x, IN.y + 0.5, IN.z]} intensity={playing && !saving ? 4 : 0} distance={3} color="#00e5ff" />
      {/* 디스크를 앞에서 비추는 빛 — 라벨이 어둠에 묻히지 않게 */}
      <pointLight position={[X0, 1.4, DEPTH + 3]} intensity={2.2} distance={9} decay={2} color="#dfe8f2" />
    </>
  );
}
