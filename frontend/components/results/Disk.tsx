"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { tossDisk } from "./flying";
import type { Track } from "./tracks";

const THROW_SPEED = 0.4; // 이보다 빠르게 위로 뿌리면 던진 것으로 본다 (px/ms)

/* 플로피 디스크 — 호버 시 점수 타자기 인쇄, 드래그 360도 회전, 더블클릭 재생, 아래 라벨에서 보고서(5.1)로.
   위로 홱 뿌리면 손을 떠나 배경 3D 장면으로 넘어간다 — 진짜 3D 플로피가 되어 둘러선 서류함 벽에
   부딪히고, 바닥에 떨어져 멎으면 목록에서 빠진다(onDiscard) */
export default function Disk({
  track,
  index,
  playing,
  query,
  onPlay,
  onDiscard,
}: {
  track: Track;
  index: number;
  playing: boolean;
  query: string;
  onPlay: () => void;
  onDiscard: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null); // 캐러셀에서 이 디스크가 차지한 자리
  const rot = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const drag = useRef<{ px: number; py: number } | null>(null);
  const flick = useRef({ vx: 0, vy: 0, t: 0, up: 0 }); // 마지막 손놀림 — 속도(px/ms)와 위로 끌어올린 거리
  const raf = useRef(0);
  const typer = useRef<ReturnType<typeof setInterval>>(undefined);
  const [typed, setTyped] = useState(0);
  const [hover, setHover] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [gone, setGone] = useState(false); // 손을 떠났다 — 3D 장면이 맡고 있는 동안 캐러셀에서는 감춘다
  const score = `[의미 유사도: ${track.semantic}% | 분위기 일치도: ${track.mood}%]`;

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    clearInterval(typer.current);
  }, []);

  const apply = () => {
    const r = rot.current;
    ref.current!.style.transform = `rotateX(${r.x}deg) rotateY(${r.y}deg)`;
  };

  /* 호버 — 살짝 들리며 라벨지에 점수가 타자기로 드르륵 인쇄 */
  function enter() {
    setHover(true);
    clearInterval(typer.current);
    typer.current = setInterval(() => {
      setTyped((n) => {
        if (n >= score.length) clearInterval(typer.current);
        return Math.min(n + 1, score.length);
      });
    }, 28);
  }
  function leave() {
    setHover(false);
    clearInterval(typer.current);
    setTyped(0);
  }

  /* 드래그 — 360도 자유 회전, 놓으면 관성 감속 후 정면 복귀 */
  function down(e: PointerEvent<HTMLDivElement>) {
    cancelAnimationFrame(raf.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY };
    flick.current = { vx: 0, vy: 0, t: e.timeStamp, up: 0 };
    setGrabbing(true);
  }
  function move(e: PointerEvent) {
    if (!drag.current) return;
    const r = rot.current;
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    // 손놀림 속도 — 놓는 순간 던질지 판단한다
    const f = flick.current;
    const dt = Math.max(1, e.timeStamp - f.t);
    f.vx = dx / dt;
    f.vy = dy / dt;
    f.t = e.timeStamp;
    f.up = dy < 0 ? f.up - dy : 0; // 아래로 방향이 바뀌면 처음부터
    r.vy = dx * 0.6;
    r.vx = -dy * 0.6;
    r.x += r.vx;
    r.y += r.vy;
    drag.current = { px: e.clientX, py: e.clientY };
    apply();
  }
  function up() {
    if (!drag.current) return;
    drag.current = null;
    setGrabbing(false);
    const f = flick.current;
    if (f.vy < -THROW_SPEED && f.up > 40) return launch(f.vx * 1000, f.vy * 1000);
    const r = rot.current;
    const step = () => {
      if (Math.abs(r.vx) + Math.abs(r.vy) > 0.3) {
        r.x += r.vx;
        r.y += r.vy;
        r.vx *= 0.94;
        r.vy *= 0.94;
      } else {
        // 가장 가까운 정면(360도 배수)으로 스프링 복귀
        r.vx = r.vy = 0;
        const tx = Math.round(r.x / 360) * 360;
        const ty = Math.round(r.y / 360) * 360;
        r.x += (tx - r.x) * 0.12;
        r.y += (ty - r.y) * 0.12;
        if (Math.abs(tx - r.x) + Math.abs(ty - r.y) < 0.1) {
          r.x = r.y = 0;
          apply();
          return;
        }
      }
      apply();
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }

  /* 던지기 — 여기서 손을 떠나고, 그다음은 배경 3D 장면(Flights)이 맡는다.
     납작한 화면 조각이 아니라 진짜 3D 플로피가 되어 둘러선 서류함 벽에 부딪힌다 */
  function launch(vx0: number, vy0: number) {
    cancelAnimationFrame(raf.current);
    const box = slot.current!.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    setGone(true); // 캐러셀의 디스크는 손을 떠났으니 감춘다 (자리는 바닥에 멎을 때까지 남겨 둔다)
    tossDisk({
      track,
      ndc: [(cx / innerWidth) * 2 - 1, -((cy / innerHeight) * 2 - 1)],
      vx: vx0,
      vy: vy0,
      onLanded: onDiscard,
    });
  }

  const face = "absolute inset-0 rounded-[4px] bg-[#1c2230] [backface-visibility:hidden] [clip-path:polygon(0_0,92%_0,100%_7%,100%_100%,0_100%)]";

  const body = (
    <div className="flex flex-col items-center gap-5">
      <div className="[perspective:1000px]">
        <div className={`transition-transform duration-300 ${hover && !grabbing && !gone ? "-translate-y-3" : ""}`}>
          <div
            ref={ref}
            role="button"
            tabIndex={0}
            aria-label={`${track.artist} - ${track.title} 미리듣기`}
            onPointerEnter={enter}
            onPointerLeave={leave}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onDoubleClick={onPlay}
            onKeyDown={(e) => e.key === "Enter" && onPlay()}
            className={`relative h-64 w-60 touch-pan-x select-none [transform-style:preserve-3d] outline-none focus-visible:ring-1 focus-visible:ring-accent ${grabbing ? "cursor-grabbing" : "cursor-grab"} ${playing ? "drop-shadow-[0_0_24px_rgba(0,229,255,.45)]" : ""}`}
          >
            {/* 앞면 — 금속 셔터 + 앨범 이미지가 인쇄된 라벨지 */}
            <div className={face}>
              <div className="absolute top-0 left-1/2 h-[34%] w-1/2 -translate-x-1/2 rounded-b-sm bg-gradient-to-b from-[#c9ced6] to-[#8a919c]">
                <div className="absolute top-3 right-4 h-[55%] w-4 rounded-[2px] bg-[#1c2230]" />
              </div>
              <div className="absolute inset-x-4 bottom-3 flex h-[56%] flex-col overflow-hidden rounded-sm bg-[#ece8dc] text-[#212529]">
                <div className="flex-1" style={{ background: track.cover }} />
                <div className="px-2 py-1.5 font-mono">
                  <p className="truncate text-[11px]">{track.title}</p>
                  <p className="h-3 truncate text-[8px] text-[#0a6e7a]">{score.slice(0, typed)}</p>
                </div>
              </div>
            </div>
            {/* 뒷면 — 플라스틱 마감과 금속 원형 드라이브 허브 */}
            <div className={`${face} [transform:rotateY(180deg)]`}>
              <div className="absolute top-0 left-1/2 h-[34%] w-1/2 -translate-x-1/2 rounded-b-sm bg-gradient-to-b from-[#c9ced6] to-[#8a919c]" />
              <div className="absolute top-[58%] left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_35%,#eef1f5,#7d8591)] shadow-[inset_0_0_0_3px_rgba(0,0,0,.15)]">
                <div className="size-3 bg-[#1c2230]" />
              </div>
              <div className="absolute bottom-3 left-3 size-3 bg-[#0e121a]" />
              <p className="absolute right-3 bottom-3 font-mono text-[8px] text-white/30">2HD 1.44MB</p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-sm">
        {track.title}
        <span className="block text-xs text-foreground/50">{track.artist}</span>
        <Link
          href={`/report/${track.id}?q=${encodeURIComponent(query)}`}
          className="mt-2 inline-block font-mono text-[10px] tracking-[.2em] text-accent/70 hover:text-accent"
        >
          보고서 열람
        </Link>
      </p>
    </div>
  );

  return (
    <div
      ref={slot}
      className="flex shrink-0 snap-center flex-col items-center animate-[pop_.7s_cubic-bezier(.3,1.5,.5,1)_both]"
      style={{ animationDelay: `${index * 130}ms` }}
    >
      {/* 3D 로 날아가는 동안에도 캐러셀의 자리는 비워 둔다 — 남은 디스크가 갑자기 밀리지 않게 */}
      <div className={gone ? "invisible" : undefined}>{body}</div>
    </div>
  );
}
