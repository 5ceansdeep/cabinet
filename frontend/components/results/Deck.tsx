"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, type Group, type Mesh } from "three";
import { thud } from "@/lib/thud";
import { DISK, FloppyBody, useLabel } from "./floppy";
import { MOUTH } from "./SaveDrawer";
import { tossDisk } from "./flying";
import type { Track } from "./tracks";

/* 꾹 누르는 동안 차오르는 원 게이지 — 캔버스에 호를 그려 디스크 앞에 띄운다 */
function useGauge() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const tex = new CanvasTexture(c);
    const draw = (p: number) => {
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
   아래로 홱 내리면 밑의 드라이브 슬롯에 꽂혀 재생되고, 꽂힌 디스크를 위로 올리면 빠지며 멈춘다 */

const GAP = 1.25; // 디스크 사이 간격
const DEPTH = -2.8; // 가운데 디스크의 깊이
const THROW_SPEED = 0.35; // 이보다 빠르게 위로 뿌리면 던진 것 (px/ms)
const MIN_UP = 12.5; // 살살 뿌려도 이만큼은 솟구친다 (월드 단위/s) — 가파른 포물선
const TO_WALL = 3.8; // 벽 쪽으로 밀어주는 속도 — 앞으로 덜 뻗고 위로 솟게
const HOLD_MS = 900; // 이만큼 가만히 꾹 누르고 있으면 저절로 던져진다
const HOLD_SLOP = 6; // 이만큼(px) 움직이면 꾹 누르기가 아니라 돌리기 — 게이지를 취소한다
export const SLOT: [number, number, number] = [0, -1.0, DEPTH]; // 드라이브 — 가운데 디스크 바로 아래
const SLOT_TOP = SLOT[1] + 0.09;
const SHOWN = 0.32; // 꽂힌 디스크가 슬롯 위로 드러나는 몫

function Disk({
  track,
  offset,
  slot,
  perPx,
  swallow,
  onInsert,
  onEject,
  onDiscard,
}: {
  track: Track;
  offset: number; // 가운데에서 몇 칸 떨어졌나
  slot: boolean; // 드라이브에 꽂혀 재생 중
  perPx: number; // 화면 1px 이 이 깊이에서 몇 월드인가
  swallow: number; // 0 이상이면 서랍으로 빨려 든다 — 값은 순서대로 늦어지는 지연(초)
  onInsert: () => void;
  onEject: () => void;
  onDiscard: () => void;
}) {
  const g = useRef<Group>(null!);
  const label = useLabel(track);
  const spin = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const drag = useRef<{ px: number; py: number } | null>(null);
  const start = useRef({ x: 0, y: 0 }); // 누른 자리 — 여기서 벗어나면 꾹 누르기 취소
  const flick = useRef({ vx: 0, vy: 0, t: 0, up: 0, down: 0 });
  const typed = useRef(0);
  const sank = useRef(Infinity); // 이 디스크가 빨려 들기 시작하는 시각
  const held = useRef(false); // 꾹 누르고 있나
  const prog = useRef(0); // 게이지 0~1
  const gaugeRef = useRef<Mesh>(null!);
  const gauge = useGauge();
  const [hover, setHover] = useState(false);
  const [thrown, setThrown] = useState(false);
  const { invalidate } = useThree();

  /* 손을 떠난다 — 손놀림(vx)이 있으면 그 방향으로, 꾹 눌러 던지면 곧장 위로 */
  function launch(vx: number, vy = MIN_UP) {
    const p = g.current.position;
    held.current = false;
    drag.current = null;
    removeEventListener("pointermove", move);
    setThrown(true);
    thud(150);
    tossDisk({ track, p: [p.x, p.y, p.z], v: [vx, vy, -TO_WALL], onLanded: onDiscard });
  }

  useFrame(({ clock }, dt) => {
    if (thrown) return;
    const o = g.current;
    // 서랍에 넣는 중 — 차례로 아래 서랍 입으로 빨려 들며 눕고 작아진다
    if (swallow >= 0) {
      if (sank.current === Infinity) sank.current = clock.elapsedTime + swallow;
      const eat = clock.elapsedTime >= sank.current;
      const kk = 1 - Math.exp(-5 * dt);
      if (eat) {
        o.position.x += (MOUTH[0] - o.position.x) * kk;
        o.position.y += (MOUTH[1] - o.position.y) * kk;
        o.position.z += (MOUTH[2] - o.position.z) * kk;
        o.rotation.x += (Math.PI / 2 - o.rotation.x) * kk; // 눕혀서 들어간다
        const want = Math.max(0, 1 - (clock.elapsedTime - sank.current) * 1.4);
        o.scale.setScalar(o.scale.x + (want - o.scale.x) * kk);
      }
      invalidate();
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
    const target = slot
      ? { x: SLOT[0], y: SLOT_TOP + DISK * (SHOWN - 0.5), z: SLOT[2] }
      : { x: offset * GAP, y: hover ? 0.16 : 0, z: DEPTH - Math.abs(offset) * 0.35 };
    const k = 1 - Math.exp(-7 * dt);
    o.position.x += (target.x - o.position.x) * k;
    o.position.y += (target.y - o.position.y) * k;
    o.position.z += (target.z - o.position.z) * k;
    // 놓은 뒤 관성으로 돌다가 정면으로 복귀
    const s = spin.current;
    if (!drag.current) {
      s.x += (0 - s.x) * k * 0.6 + s.vx;
      s.y += (0 - s.y) * k * 0.6 + s.vy;
      s.vx *= 0.94;
      s.vy *= 0.94;
    }
    o.rotation.set(s.x, s.y, 0);
    // 호버하면 점수가 한 글자씩 찍힌다
    const want = hover ? label.length : 0;
    if (typed.current !== want) {
      typed.current += Math.sign(want - typed.current) * Math.max(1, Math.round(dt * 60));
      typed.current = Math.max(0, Math.min(label.length, typed.current));
      label.draw(typed.current);
    }
    invalidate();
  });

  /* 잡기 — 디스크 밖으로 끌고 나가도 끊기지 않게 창 전체에서 손놀림을 듣는다 */
  function down(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    held.current = !slot; // 꽂힌 디스크는 꾹 눌러도 던져지지 않는다
    prog.current = 0;
    drag.current = { px: e.clientX, py: e.clientY };
    start.current = { x: e.clientX, y: e.clientY };
    flick.current = { vx: 0, vy: 0, t: e.timeStamp, up: 0, down: 0 };
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
    const dt = Math.max(1, e.timeStamp - f.t);
    f.vx = dx / dt;
    f.vy = dy / dt;
    f.t = e.timeStamp;
    f.up = dy < 0 ? f.up - dy : 0; // 아래로 방향이 바뀌면 처음부터
    f.down = dy > 0 ? f.down + dy : 0;
    const s = spin.current;
    s.vy = dx * 0.012;
    s.vx = dy * 0.012;
    s.y += s.vy;
    s.x += s.vx;
    drag.current = { px: e.clientX, py: e.clientY };
    invalidate();
  }

  function up() {
    removeEventListener("pointermove", move);
    held.current = false;
    if (!drag.current) return;
    drag.current = null;
    const f = flick.current;
    // 아래로 홱 — 슬롯에 꽂는다
    if (!slot && f.vy > THROW_SPEED && f.down > 40) return onInsert();
    if (f.vy > -THROW_SPEED || f.up <= 40) return; // 살살 놓았다 — 그냥 제자리로
    if (slot) return onEject(); // 꽂힌 디스크를 위로 — 빼서 제자리로
    // 화면은 아래가 +y, 3D 는 위가 +y — 부호를 뒤집어 위로 솟구치게 한다
    launch(f.vx * 1000 * perPx * 0.35, Math.max(-f.vy * 1000 * perPx, MIN_UP));
  }

  if (thrown) return null; // 이제부터는 Flights 가 그린다

  return (
    <group
      ref={g}
      position={[offset * GAP, 0, DEPTH]}
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
      {/* 재생 중이면 시안 빛을 머금는다 */}
      {slot && <pointLight position={[0, 0, 0.5]} intensity={4} distance={3} color="#00e5ff" />}
    </group>
  );
}

/* 재생 드라이브 — 윗면에 디스크를 꽂는 틈. 재생 중이면 불이 켜진다 */
function Drive({ on, visible }: { on: boolean; visible: boolean }) {
  return (
    <group position={SLOT} visible={visible}>
      <RoundedBox args={[1.25, 0.18, 0.55]} radius={0.02} smoothness={3}>
        <meshStandardMaterial color="#20252d" roughness={0.6} metalness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0.091, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[DISK + 0.06, 0.07]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh position={[0.5, 0, 0.276]}>
        <circleGeometry args={[0.018, 12]} />
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
          onInsert={() => onInsert(t)}
          onEject={onEject}
          onDiscard={() => onDiscard(t)}
        />
      ))}
      <Drive on={!!playing} visible={!saving} />
      {/* 디스크를 앞에서 비추는 빛 — 라벨이 어둠에 묻히지 않게 */}
      <pointLight position={[0, 1.4, DEPTH + 3]} intensity={3.2} distance={9} decay={2} color="#dfe8f2" />
    </>
  );
}
