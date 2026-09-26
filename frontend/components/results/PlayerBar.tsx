"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "./tracks";

/* 드라이브에 꽂힌 곡의 재생바 — 커버, 곡 이름, 재생/멈춤, 끌어서 옮기는 진행 막대, 꺼내기.
   소리는 iTunes 30초 미리듣기. 미리듣기가 없는 곡은 막대 없이 알려만 준다 */

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function PlayerBar({ track, onEject }: { track: Track | null; onEject: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [paused, setPaused] = useState(true);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(30);

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

  return (
    <div
      className={`relative mx-auto mb-4 w-[min(92vw,560px)] transition duration-300 ${track ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
      aria-hidden={!track}
    >
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={() => setPaused(true)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setLength(e.currentTarget.duration || 30)}
      />
      {track && (
        <div className="flex items-center gap-3 rounded-md border border-white/10 bg-neutral-900/80 p-2 pr-3 shadow-[0_8px_30px_rgba(0,0,0,.5)] backdrop-blur">
          {/* 커버 — 없으면 디스크 라벨과 같은 그라디언트 */}
          <div
            className="size-11 shrink-0 rounded-sm bg-cover bg-center"
            style={{ backgroundImage: track.artwork ? `url(${track.artwork})` : track.cover }}
          />
          <button
            onClick={toggle}
            disabled={!track.previewUrl}
            aria-label={paused ? "재생" : "멈춤"}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/90 text-neutral-900 transition hover:bg-white disabled:opacity-30"
          >
            {paused ? "▶" : "❚❚"}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              {track.title} <span className="text-foreground/50">· {track.artist}</span>
            </p>
            {track.previewUrl ? (
              <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-foreground/50">
                <span className="w-7 text-right">{time(at)}</span>
                <input
                  type="range"
                  min={0}
                  max={length}
                  step={0.1}
                  value={at}
                  onChange={(e) => {
                    if (audio.current) audio.current.currentTime = Number(e.target.value);
                  }}
                  aria-label="재생 위치"
                  className="h-1 flex-1 cursor-pointer accent-accent"
                />
                <span className="w-7">{time(length)}</span>
              </div>
            ) : (
              <p className="mt-1 font-mono text-[10px] tracking-[.15em] text-foreground/40">미리듣기 없음</p>
            )}
          </div>
          <button onClick={onEject} aria-label="꺼내기" className="shrink-0 px-1 font-mono text-foreground/50 hover:text-foreground">
            ⏏
          </button>
        </div>
      )}
    </div>
  );
}
