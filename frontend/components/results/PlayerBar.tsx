"use client";

import { useEffect, useRef, useState } from "react";
import { logEvent } from "@/lib/api";
import type { Track } from "./tracks";

/* 드라이브에 꽂힌 곡의 재생 — 오른쪽 곡 목록 아래. 동그란 재생 버튼, 곡 이름, 얇은 파란 진행선(누르거나 끌어서 옮긴다), 꺼내기.
   소리는 iTunes 30초 미리듣기. 미리듣기가 없는 곡은 진행선 없이 알려만 준다.
   10/1: 상자 + 기본 range 막대였던 걸 걷어 내고 선 하나로 단순하게 */

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const Play = () => (
  <svg viewBox="0 0 16 16" className="ml-0.5 size-3.5" aria-hidden>
    <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
  </svg>
);
const Pause = () => (
  <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
    <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" />
  </svg>
);

export default function PlayerBar({ track, onEject }: { track: Track | null; onEject: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [paused, setPaused] = useState(true);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(30);
  const played = useRef<string | null>(null); // 이 곡의 재생을 이미 기록했나 — 멈췄다 다시 틀면 안 센다

  // 곡이 바뀌면 처음부터 튼다
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    setAt(0);
    if (track?.previewUrl) {
      a.src = track.previewUrl;
      a.play().catch(() => setPaused(true));
    } else {
      a.pause();
      a.removeAttribute("src");
    }
  }, [track]);

  const toggle = () => {
    const a = audio.current;
    if (!a?.src) return;
    if (a.paused) a.play().catch(() => undefined);
    else a.pause();
  };

  // 진행선 — 누른 자리로 옮기고, 누른 채 끌면 따라간다
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (audio.current) audio.current.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * length;
  };

  return (
    <div className={`transition duration-300 ${track ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!track}>
      <audio
        ref={audio}
        preload="none"
        onPlay={() => {
          setPaused(false);
          if (track && played.current !== track.id) logEvent("play", { trackId: (played.current = track.id) });
        }}
        onPause={() => setPaused(true)}
        onEnded={() => {
          setPaused(true);
          if (track) logEvent("finish", { trackId: track.id });
        }}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setLength(e.currentTarget.duration || 30)}
      />
      {track && (
        <div className="border-t border-accent/15 pt-[1em]">
          <div className="flex items-center gap-[.8em]">
            <button
              onClick={toggle}
              disabled={!track.previewUrl}
              aria-label={paused ? "재생" : "멈춤"}
              className="grid size-[2.4em] shrink-0 place-items-center rounded-full border border-accent/50 text-accent transition hover:bg-accent/10 disabled:opacity-30"
            >
              {paused ? <Play /> : <Pause />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-foreground/90">{track.title}</p>
              <p className="truncate text-[.85em] text-accent/60">{track.artist}</p>
            </div>
            <button onClick={onEject} aria-label="꺼내기" className="shrink-0 px-1 text-accent/50 transition hover:text-accent">
              ⏏
            </button>
          </div>
          {track.previewUrl ? (
            <>
              <div
                role="slider"
                aria-label="재생 위치"
                aria-valuemin={0}
                aria-valuemax={Math.round(length)}
                aria-valuenow={Math.round(at)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (!audio.current) return;
                  if (e.key === "ArrowRight") audio.current.currentTime = Math.min(length, at + 5);
                  if (e.key === "ArrowLeft") audio.current.currentTime = Math.max(0, at - 5);
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  seek(e);
                }}
                onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && seek(e)}
                className="group relative mt-[.9em] h-3 cursor-pointer"
              >
                <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-accent/15" />
                <div className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 bg-accent" style={{ width: `${(at / length) * 100}%` }} />
                <div
                  className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0 transition group-hover:opacity-100"
                  style={{ left: `${(at / length) * 100}%` }}
                />
              </div>
              <div className="mt-[.2em] flex justify-between font-mono text-[.75em] tabular-nums text-accent/40">
                <span>{time(at)}</span>
                <span>{time(length)}</span>
              </div>
            </>
          ) : (
            <p className="mt-[.8em] font-mono text-[.75em] tracking-[.15em] text-accent/40">미리듣기 없음</p>
          )}
        </div>
      )}
    </div>
  );
}
