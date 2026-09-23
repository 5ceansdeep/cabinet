"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { thud } from "@/lib/thud";
import type { Track } from "./tracks";

const G = 2800; // 중력 (px/s²)
const THROW_SPEED = 0.45; // 이보다 빠르게 위로 뿌리면 던진 것으로 본다 (px/ms)

/* 플로피 디스크 — 호버 시 점수 타자기 인쇄, 드래그 360도 회전, 더블클릭 재생, 아래 라벨에서 보고서(5.1)로.
   위로 홱 뿌리면 손에서 놓여 날아간다 — 중력을 받아 뒤 서류함 벽에 부딪히고 바닥까지 떨어지면 빠진다(onDiscard) */
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
  const wrap = useRef<HTMLDivElement>(null); // 던져진 뒤 날아가는 몸체 (pop 애니메이션과 transform 이 겹치지 않게 따로)
  const rot = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const drag = useRef<{ px: number; py: number } | null>(null);
  const flick = useRef({ vx: 0, vy: 0, t: 0, up: 0 }); // 마지막 손놀림 — 속도(px/ms)와 위로 끌어올린 거리
  const raf = useRef(0);
  const typer = useRef<ReturnType<typeof setInterval>>(undefined);
  const [typed, setTyped] = useState(0);
  const [hover, setHover] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [thrown, setThrown] = useState(false);
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
    f.up = dy < 0 ? f.up - dy : 0; // 방향이 바뀌면 처음부터
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
    if (f.vy < -THROW_SPEED && f.up > 40) return fly(f.vx * 1000, f.vy * 1000);
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

  /* 던지기 — 포물선을 그리며 날아가 뒤 서류함 벽(화면 위쪽)에 부딪혀 튕기고, 바닥에 몇 번 구르다 멎으면 목록에서 빠진다 */
  function fly(vx0: number, vy0: number) {
    cancelAnimationFrame(raf.current);
    setThrown(true);
    const el = wrap.current!;
    const box = el.getBoundingClientRect();
    const ceil = -box.top + 12; // 화면 위 = 뒤에 세워진 서류함 벽
    const floor = innerHeight - box.bottom - 8;
    let x = 0;
    let y = 0;
    let vx = vx0;
    let vy = vy0;
    let spin = 0;
    const omega = vx0 * 0.35 + 120;
    let last = performance.now();
    let rest = 0; // 바닥에서 잠잠해진 시간(ms)
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      vy += G * dt;
      x += vx * dt;
      y += vy * dt;
      spin += omega * dt;
      if (y < ceil && vy < 0) {
        // 벽에 부딪힘
        y = ceil;
        vy = -vy * 0.45;
        vx *= 0.7;
        thud(120);
      }
      if (y > floor) {
        y = floor;
        if (vy > 260) {
          vy = -vy * 0.35; // 바닥에서 튕김
          vx *= 0.6;
          thud(60);
        } else {
          vy = 0;
          vx *= 0.8;
          rest += dt * 1000;
        }
      }
      el.style.transform = `translate(${x}px, ${y}px) rotate(${spin}deg)`;
      if (rest > 450) {
        el.style.transition = "opacity .4s";
        el.style.opacity = "0";
        setTimeout(onDiscard, 400);
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }

  const face = "absolute inset-0 rounded-[4px] bg-[#1c2230] [backface-visibility:hidden] [clip-path:polygon(0_0,92%_0,100%_7%,100%_100%,0_100%)]";

  return (
    <div className="flex shrink-0 snap-center flex-col items-center animate-[pop_.7s_cubic-bezier(.3,1.5,.5,1)_both]" style={{ animationDelay: `${index * 130}ms` }}>
      <div ref={wrap} className={`flex flex-col items-center gap-5 ${thrown ? "pointer-events-none relative z-20" : ""}`}>
      <div className="[perspective:1000px]">
        <div className={`transition-transform duration-300 ${hover && !grabbing ? "-translate-y-3" : ""}`}>
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
    </div>
  );
}
