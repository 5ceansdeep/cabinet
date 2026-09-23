"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { thud } from "@/lib/thud";
import CabinetWall from "./CabinetWall";
import Riffle from "./Riffle";
import { TRACKS, type Track } from "./tracks";

/* 4·4-1번 페이지 — 서랍 속에서 건져 올린 플로피 디스크들. 디스크도 서류함도 전부 3D 이고,
   그 위에 얹힌 DOM 은 제목·보고서 링크 같은 글자뿐이다 */
export default function Results({ query }: { query: string }) {
  const [phase, setPhase] = useState<"riffle" | "discs">("riffle");
  const [playing, setPlaying] = useState<number | null>(null);
  const [kept, setKept] = useState(TRACKS); // 위로 던져 뺀 곡은 여기서 빠진다
  const [index, setIndex] = useState(Math.floor(TRACKS.length / 2)); // 가운데 앞에 나온 곡

  /* Bruce Almighty — 촤르르륵 넘어가던 카드가 딱 멈추면 디스크가 나온다 */
  useEffect(() => {
    const id = setTimeout(() => {
      thud(70);
      setPhase("discs");
    }, 1600);
    return () => clearTimeout(id);
  }, []);

  const move = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(kept.length - 1, i + d))), [kept.length]);

  // 좌우 화살표 키로도 넘긴다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [move]);

  function play(track: Track) {
    // ponytail: 음원 없음 — preview URL 받으면 <audio> 로 실제 재생
    thud(160);
    setPlaying(track.id);
  }

  function discard(track: Track) {
    setKept((ts) => ts.filter((t) => t.id !== track.id));
    setIndex((i) => Math.max(0, Math.min(kept.length - 2, i)));
  }

  const center = kept[index];
  const nowPlaying = kept.find((t) => t.id === playing);

  return (
    <main data-theme="void" className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-background text-foreground">
      {phase === "riffle" ? (
        <Riffle />
      ) : (
        <>
          <CabinetWall tracks={kept} index={index} playing={playing} onPlay={play} onDiscard={discard} />

          <header className="pointer-events-none relative flex items-start justify-between gap-4 px-6 pt-6 font-mono text-[10px] tracking-[.2em] text-foreground/50">
            <p className="max-w-xl">
              QUERY — <span className="normal-case tracking-normal text-foreground/80">{query || "(empty)"}</span>
            </p>
            <Link href="/search" className="pointer-events-auto shrink-0 text-accent/80 hover:text-accent">
              NEW REQUEST
            </Link>
          </header>

          <div className="flex-1" />

          {/* 가운데 디스크의 이름표 — 3D 디스크 아래에 놓인다 */}
          {center && (
            <div className="relative pb-1 text-center">
              <p className="text-sm">
                {center.title}
                <span className="block text-xs text-foreground/50">{center.artist}</span>
              </p>
              <Link
                href={`/report/${center.id}?q=${encodeURIComponent(query)}`}
                className="mt-2 inline-block font-mono text-[10px] tracking-[.2em] text-accent/70 hover:text-accent"
              >
                보고서 열람
              </Link>
            </div>
          )}

          <div className="relative flex items-center justify-center gap-10 pb-2">
            {[-1, 1].map((dir) => (
              <button
                key={dir}
                aria-label={dir < 0 ? "이전 디스크" : "다음 디스크"}
                onClick={() => move(dir)}
                className="px-4 py-2 font-mono text-accent/60 hover:text-accent"
              >
                {dir < 0 ? "◀" : "▶"}
              </button>
            ))}
          </div>

          <footer className="relative px-6 pb-6 text-center font-mono text-[10px] tracking-[.2em] text-foreground/40" aria-live="polite">
            {nowPlaying ? (
              <span className="text-accent">
                ▶ NOW PLAYING — {nowPlaying.artist} · {nowPlaying.title}
              </span>
            ) : (
              "DRAG TO ROTATE · DOUBLE-CLICK TO PLAY · FLICK UP TO DISCARD"
            )}
          </footer>
        </>
      )}
    </main>
  );
}
