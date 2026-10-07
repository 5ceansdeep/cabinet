"use client";

import { useEffect, useRef, useState } from "react";
import { Eject, Pause, Play, SkipBack, SkipForward } from "@phosphor-icons/react";
import { logEvent } from "@/lib/api";
import { vinyl } from "@/lib/vinyl";
import LikeButton from "./LikeButton";
import type { Track } from "./tracks";

/* 드라이브에 꽂힌 곡의 재생 — 오른쪽 곡 목록 아래. 동그란 재생 버튼, 곡 이름, 얇은 파란 진행선(누르거나 끌어서 옮긴다), 꺼내기.
   소리는 iTunes 30초 미리듣기. 미리듣기가 없는 곡은 진행선 없이 알려만 준다.
   10/1: 상자 + 기본 range 막대였던 걸 걷어 내고 선 하나로 단순하게 */

const FADE_MS = 2200; // 이어 듣는 곡이 다 올라오기까지
const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;


/* from = 어떤 편지로 꺼낸 곡인가(요청문, 공개 서랍이면 서랍 id) — 재생 기록에 같이 남긴다 */
/* card = 결과 화면의 카드 모양(아래), onPrev·onNext = 이전·다음 곡(없으면 버튼이 흐려진다) */
export default function PlayerBar({
  track,
  onEject,
  from,
  card,
  onPrev,
  onNext,
}: {
  track: Track | null;
  onEject: () => void;
  from?: { query?: string; shelfId?: string };
  card?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [paused, setPaused] = useState(true);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(30);
  const played = useRef<string | null>(null); // 이 곡의 재생을 이미 기록했나 — 멈췄다 다시 틀면 안 센다

  const chained = useRef(false); // 앞 곡이 끝나 저절로 넘어온 곡인가 — 판 소리를 깔고 서서히 올린다

  // 곡이 바뀌면 처음부터 튼다
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    setAt(0);
    const lead = chained.current;
    chained.current = false;
    let fade: ReturnType<typeof setInterval> | undefined;
    a.volume = 1;
    if (track?.previewUrl) {
      a.src = track.previewUrl;
      if (lead) {
        // 이어 듣기 — LP 판 도는 소리가 먼저 깔리고 곡이 그 위로 올라온다(10/7 사용자).
        // ponytail: 아이폰은 audio.volume 을 못 바꿔(늘 1) 곡은 바로 나오고 판 소리만 깔린다 — 거기도 올리려면 Web Audio GainNode(미리듣기 CORS 필요)
        vinyl();
        a.volume = 0;
        const t0 = performance.now();
        fade = setInterval(() => {
          const k = Math.min(1, (performance.now() - t0) / FADE_MS);
          a.volume = k * k;
          if (k >= 1) clearInterval(fade);
        }, 50);
      }
      a.play().catch(() => setPaused(true));
    } else {
      a.pause();
      a.removeAttribute("src");
    }
    return () => clearInterval(fade);
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

  const player = (
    <audio
      ref={audio}
      preload="none"
      onPlay={() => {
        setPaused(false);
        if (track && played.current !== track.id) logEvent("play", { trackId: (played.current = track.id), ...from });
      }}
      onPause={() => setPaused(true)}
      onEnded={() => {
        setPaused(true);
        if (track) logEvent("finish", { trackId: track.id, ...from });
        // 30초가 끝나면 다음 곡으로 이어 튼다(10/7 사용자) — 마지막 곡이면 멈춘다
        if (onNext) {
          chained.current = true;
          onNext();
        }
      }}
      onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => setLength(e.currentTarget.duration || 30)}
    />
  );

  /* 결과 화면 카드 — 둥근 앨범(재생 중이면 디스크처럼 천천히 돈다, 가운데 구멍) + 곡·가수·꺼내기, 진행선, 이전·재생·다음.
     10/6 사용자 레퍼런스(둥근 표지가 붙은 미니 플레이어)를 검은 방에 맞게 — 어두운 유리 카드, 시안 진행선 */
  if (card)
    return (
      <>
        {player}
        {track && (
          <div className="flex items-center gap-[1em] rounded-[1.1em] border border-white/10 bg-white/[.06] p-[.75em] pr-[.9em] shadow-[0_12px_32px_rgba(0,0,0,.45)]">
            <div className="relative size-[5.2em] shrink-0">
              <div
                className="size-full overflow-hidden rounded-full bg-gradient-to-br from-slate-600 to-slate-900 shadow-[0_6px_18px_rgba(0,0,0,.6)] ring-1 ring-white/15 animate-[spin_9s_linear_infinite] motion-reduce:animate-none"
                style={{ animationPlayState: paused ? "paused" : "running" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- iTunes 표지 */}
                {track.artwork && <img src={track.artwork} alt="" className="size-full object-cover" />}
              </div>
              <span aria-hidden className="absolute top-1/2 left-1/2 size-[.8em] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-100 ring-[.25em] ring-black/60" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-[.4em]">
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-foreground">{track.title}</p>
                  <p className="mt-[.15em] truncate text-[.82em] text-foreground/50">{track.artist}</p>
                </div>
                <LikeButton trackId={track.id} query={from?.query} className="-mt-[.3em]" />
                <button type="button" onClick={onEject} aria-label="꺼내기" className="-mt-[.3em] -mr-[.3em] grid size-[2em] shrink-0 place-items-center rounded-full text-foreground/45 transition-colors hover:text-foreground pointer-coarse:size-10">
                  <Eject aria-hidden weight="fill" className="size-[1em]" />
                </button>
              </div>
              {track.previewUrl ? (
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
                  className="relative mt-[.55em] h-[1em] cursor-pointer touch-none"
                >
                  <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 overflow-hidden rounded-full bg-white/12">
                    <div className="h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${at / length})` }} />
                  </div>
                </div>
              ) : (
                <p className="mt-[.55em] text-[.75em] text-foreground/45">미리듣기 없음</p>
              )}
              <div className="mt-[.2em] flex items-center justify-between">
                <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="이전 곡" className="grid size-[2.2em] place-items-center text-foreground/80 transition hover:text-foreground disabled:opacity-25 pointer-coarse:size-10">
                  <SkipBack aria-hidden weight="fill" className="size-[1.1em]" />
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  disabled={!track.previewUrl}
                  aria-label={paused ? "재생" : "멈춤"}
                  className="grid size-[2.5em] place-items-center rounded-full bg-accent text-background transition hover:brightness-110 disabled:opacity-30 pointer-coarse:size-11"
                >
                  {paused ? <Play aria-hidden weight="fill" className="ml-[.1em] size-[1.1em]" /> : <Pause aria-hidden weight="fill" className="size-[1.1em]" />}
                </button>
                <button type="button" onClick={onNext} disabled={!onNext} aria-label="다음 곡" className="grid size-[2.2em] place-items-center text-foreground/80 transition hover:text-foreground disabled:opacity-25 pointer-coarse:size-10">
                  <SkipForward aria-hidden weight="fill" className="size-[1.1em]" />
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );

  return (
    <div className={`transition duration-300 ${track ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!track}>
      {player}
      {track && (
        <div className="border-t border-accent/15 pt-[1em]">
          <div className="flex items-center gap-[.8em]">
            <button
              type="button"
              onClick={toggle}
              disabled={!track.previewUrl}
              aria-label={paused ? "재생" : "멈춤"}
              className="grid size-[2.4em] shrink-0 place-items-center rounded-full border border-accent/50 text-accent transition hover:bg-accent/10 disabled:opacity-30 pointer-coarse:size-11"
            >
              {paused ? <Play aria-hidden weight="fill" className="ml-0.5 size-3.5" /> : <Pause aria-hidden weight="fill" className="size-3.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-foreground/90">{track.title}</p>
              <p className="truncate text-[.85em] text-accent/75">{track.artist}</p>
            </div>
            <button type="button" onClick={onEject} aria-label="꺼내기" className="grid size-8 shrink-0 place-items-center rounded-full text-accent/75 transition-colors hover:text-accent pointer-coarse:size-11">
              <Eject aria-hidden weight="fill" className="size-4" />
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
                className="group relative mt-[.9em] h-3 cursor-pointer touch-none pointer-coarse:mt-[.4em] pointer-coarse:h-6" // 터치는 잡을 높이를 넉넉히, 끌 때 화면이 따라 움직이지 않게
              >
                <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-accent/15" />
                <div className="absolute inset-x-0 top-1/2 h-[2px] origin-left -translate-y-1/2 bg-accent" style={{ transform: `translateY(-50%) scaleX(${at / length})` }} />
                <div
                  className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0 transition group-hover:opacity-100"
                  style={{ left: `${(at / length) * 100}%` }}
                />
              </div>
              <div className="mt-[.2em] flex justify-between font-mono text-[.75em] tabular-nums text-accent/70">
                <span>{time(at)}</span>
                <span>{time(length)}</span>
              </div>
            </>
          ) : (
            <p className="mt-[.8em] font-mono text-[.75em] tracking-[.15em] text-accent/70">미리듣기 없음</p>
          )}
        </div>
      )}
    </div>
  );
}
