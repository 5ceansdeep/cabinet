"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { CanvasTexture, type Group, type Mesh } from "three";
import { thud } from "@/lib/thud";
import { FloppyBody, useLabel } from "./floppy";
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
      ctx.lineWidth = 12;
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.beginPath();
      ctx.arc(128, 128, 92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#00e5ff";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(128, 128, 92, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
      tex.needsUpdate = true;
    };
    draw(0);
    return { tex, draw };
  }, []);
}

/* 결과 디스크들 — 전부 3D 덩어리. 가운데 곡이 앞으로 나오고 양옆은 뒤로 물러난다.
   호버하면 들리며 라벨에 점수가 타자기로 찍히고, 잡고 끌면 돌아가고, 위로 홱 뿌리면 손을 떠난다 */

const GAP = 1.25; // 디스크 사이 간격
const DEPTH = -2.8; // 가운데 디스크의 깊이
const THROW_SPEED = 0.35; // 이보다 빠르게 위로 뿌리면 던진 것 (px/ms)
const MIN_UP = 12.5; // 살살 뿌려도 이만큼은 솟구친다 (월드 단위/s) — 가파른 포물선
const TO_WALL = 3.8;
const HOLD_MS = 900; // 이만큼 꾹 누르고 있으면 저절로 던져진다 // 벽 쪽으로 밀어주는 속도 — 앞으로 덜 뻗고 위로 솟게

function Disk({
  track,
  offset,
  playing,
  perPx,
  swallow,
  onPlay,
  onDiscard,
}: {
  track: Track;
  offset: number; // 가운데에서 몇 칸 떨어졌나
  playing: boolean;
  perPx: number; // 화면 1px 이 이 깊이에서 몇 월드인가
  swallow: number; // 0 이상이면 서랍으로 빨려 든다 — 값은 순서대로 늦어지는 지연(초)
  onPlay: () => void;
  onDiscard: () => void;
}) {
  const g = useRef<Group>(null!);
  const label = useLabel(track);
  const spin = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const drag = useRef<{ px: number; py: number } | null>(null);
  const flick = useRef({ vx: 0, vy: 0, t: 0, up: 0 });
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
      gaugeRef.current.scale.setScalar(0.9 + p * 0.15);
      if (p >= 1) launch(0); // 다 찼다 — 저절로 날아간다
      invalidate();
    } else if (gaugeRef.current.visible) {
      gaugeRef.current.visible = false;
      prog.current = 0;
      gauge.draw(0);
    }
    const target = { x: offset * GAP, y: hover ? 0.16 : 0, z: DEPTH - Math.abs(offset) * 0.35 };
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
    held.current = true;
    prog.current = 0;
    drag.current = { px: e.clientX, py: e.clientY };
    flick.current = { vx: 0, vy: 0, t: e.timeStamp, up: 0 };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up, { once: true });
  }

  function move(e: PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    const f = flick.current;
    const dt = Math.max(1, e.timeStamp - f.t);
    f.vx = dx / dt;
    f.vy = dy / dt;
    f.t = e.timeStamp;
    f.up = dy < 0 ? f.up - dy : 0; // 아래로 방향이 바뀌면 처음부터
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
    if (f.vy > -THROW_SPEED || f.up <= 40) return; // 살살 놓았다 — 그냥 제자리로
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
      onDoubleClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
    >
      <FloppyBody map={label.tex} />
      {/* 꾹 누르는 동안 차오르는 원 게이지 */}
      <mesh ref={gaugeRef} position={[0, 0, 0.35]} visible={false}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshBasicMaterial map={gauge.tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* 재생 중이면 시안 빛을 머금는다 */}
      {playing && <pointLight position={[0, 0, 0.5]} intensity={4} distance={3} color="#00e5ff" />}
    </group>
  );
}

export default function Deck({
  tracks,
  index,
  playing,
  saving = false,
  onPlay,
  onDiscard,
}: {
  tracks: Track[];
  index: number;
  playing: number | null;
  saving?: boolean; // 서랍에 넣는 중
  onPlay: (t: Track) => void;
  onDiscard: (t: Track) => void;
}) {
  const { camera, size } = useThree();
  // 이 깊이에서 화면 1px 이 몇 월드인지 — 던지는 손놀림(px/ms)을 월드 속도로 바꿀 때 쓴다
  const h = 2 * Math.abs(DEPTH) * Math.tan(((camera as unknown as { fov: number }).fov * Math.PI) / 360);
  const perPx = h / size.height;

  return (
    <>
      {tracks.map((t, i) => (
        <Disk
          key={t.id}
          track={t}
          offset={i - index}
          playing={playing === t.id}
          perPx={perPx}
          swallow={saving ? i * 0.12 : -1}
          onPlay={() => onPlay(t)}
          onDiscard={() => onDiscard(t)}
        />
      ))}
      {/* 디스크를 앞에서 비추는 빛 — 라벨이 어둠에 묻히지 않게 */}
      <pointLight position={[0, 1.4, DEPTH + 3]} intensity={3.2} distance={9} decay={2} color="#dfe8f2" />
    </>
  );
}

