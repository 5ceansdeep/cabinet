"use client";

import { useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import { thud } from "@/lib/thud";
import { FloppyBody, useLabel } from "./floppy";
import { tossDisk } from "./flying";
import type { Track } from "./tracks";

/* 결과 디스크들 — 전부 3D 덩어리. 가운데 곡이 앞으로 나오고 양옆은 뒤로 물러난다.
   호버하면 들리며 라벨에 점수가 타자기로 찍히고, 잡고 끌면 돌아가고, 위로 홱 뿌리면 손을 떠난다 */

const GAP = 1.25; // 디스크 사이 간격
const DEPTH = -2.8; // 가운데 디스크의 깊이
const THROW_SPEED = 0.35; // 이보다 빠르게 위로 뿌리면 던진 것 (px/ms)
const MIN_UP = 9; // 살살 뿌려도 이만큼은 솟구친다 (월드 단위/s)
const TO_WALL = 6.5; // 벽 쪽으로 밀어주는 속도

function Disk({
  track,
  offset,
  playing,
  perPx,
  onPlay,
  onDiscard,
}: {
  track: Track;
  offset: number; // 가운데에서 몇 칸 떨어졌나
  playing: boolean;
  perPx: number; // 화면 1px 이 이 깊이에서 몇 월드인가
  onPlay: () => void;
  onDiscard: () => void;
}) {
  const g = useRef<Group>(null!);
  const label = useLabel(track);
  const spin = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const drag = useRef<{ px: number; py: number } | null>(null);
  const flick = useRef({ vx: 0, vy: 0, t: 0, up: 0 });
  const typed = useRef(0);
  const [hover, setHover] = useState(false);
  const [thrown, setThrown] = useState(false);
  const { invalidate } = useThree();

  useFrame((_, dt) => {
    if (thrown) return;
    const o = g.current;
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
    if (!drag.current) return;
    drag.current = null;
    const f = flick.current;
    if (f.vy > -THROW_SPEED || f.up <= 40) return; // 살살 놓았다 — 그냥 제자리로
    // 손을 떠난다 — 지금 자리와 속도를 그대로 물리 담당에게 넘긴다
    const p = g.current.position;
    setThrown(true);
    thud(150);
    tossDisk({
      track,
      p: [p.x, p.y, p.z],
      // 화면은 아래가 +y, 3D 는 위가 +y — 부호를 뒤집어 위로 솟구치게 한다
      v: [f.vx * 1000 * perPx * 0.5, Math.max(-f.vy * 1000 * perPx, MIN_UP), -TO_WALL],
      onLanded: onDiscard,
    });
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
      {/* 재생 중이면 시안 빛을 머금는다 */}
      {playing && <pointLight position={[0, 0, 0.5]} intensity={4} distance={3} color="#00e5ff" />}
    </group>
  );
}

export default function Deck({
  tracks,
  index,
  playing,
  onPlay,
  onDiscard,
}: {
  tracks: Track[];
  index: number;
  playing: number | null;
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
          onPlay={() => onPlay(t)}
          onDiscard={() => onDiscard(t)}
        />
      ))}
      {/* 디스크를 앞에서 비추는 빛 — 라벨이 어둠에 묻히지 않게 */}
      <pointLight position={[0, 0.8, DEPTH + 2.4]} intensity={7} distance={8} decay={2} color="#ffffff" />
    </>
  );
}

