"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { thud } from "@/lib/thud";
import Disk from "./Disk";
import Riffle from "./Riffle";
import { TRACKS, type Track } from "./tracks";

/* 4·4-1번 페이지 — 서랍 속에서 건져 올린 플로피 디스크 캐러셀 */
export default function Results({ query }: { query: string }) {
  const [phase, setPhase] = useState<"riffle" | "discs">("riffle");
  const [playing, setPlaying] = useState<number | null>(null);
  const railRef = useRef<HTMLElement>(null);

  /* Bruce Almighty — 촤르르륵 넘어가던 카드가 딱 멈추면 디스크가 튀어나온다 */
  useEffect(() => {
    const id = setTimeout(() => {
      thud(70);
      setPhase("discs");
    }, 1600);
    return () => clearTimeout(id);
  }, []);

  function play(track: Track) {
    // ponytail: 음원 없음 — preview URL 받으면 <audio> 로 실제 재생
    thud(160);
    setPlaying(track.id);
  }

  const nowPlaying = TRACKS.find((t) => t.id === playing);

  return (
    <main data-theme="void" className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-background text-foreground">
      {phase === "riffle" ? (
        <Riffle />
      ) : (
        <>
          <header className="flex items-start justify-between gap-4 px-6 pt-6 font-mono text-[10px] tracking-[.2em] text-foreground/50">
            <p className="max-w-xl">
              QUERY — <span className="normal-case tracking-normal text-foreground/80">{query || "(empty)"}</span>
            </p>
            <Link href="/search" className="shrink-0 text-accent/80 hover:text-accent">
              NEW REQUEST
            </Link>
          </header>

          <div className="relative flex flex-1 items-center">
            <section ref={railRef} className="flex w-full snap-x snap-mandatory gap-12 overflow-x-auto px-[calc(50vw-120px)] py-16 [scrollbar-width:none]">
              {TRACKS.map((t, i) => (
                <Disk key={t.id} track={t} index={i} playing={playing === t.id} query={query} onPlay={() => play(t)} />
              ))}
            </section>
            {[-1, 1].map((dir) => (
              <button
                key={dir}
                aria-label={dir < 0 ? "이전 디스크" : "다음 디스크"}
                onClick={() => railRef.current?.scrollBy({ left: dir * 288, behavior: "smooth" })}
                className={`absolute top-1/2 -translate-y-1/2 px-4 py-6 font-mono text-accent/60 hover:text-accent ${dir < 0 ? "left-2" : "right-2"}`}
              >
                {dir < 0 ? "◀" : "▶"}
              </button>
            ))}
          </div>

          <footer className="px-6 pb-6 text-center font-mono text-[10px] tracking-[.2em] text-foreground/40" aria-live="polite">
            {nowPlaying ? (
              <span className="text-accent">▶ NOW PLAYING — {nowPlaying.artist} · {nowPlaying.title}</span>
            ) : (
              "DRAG TO ROTATE · DOUBLE-CLICK TO PLAY"
            )}
          </footer>
        </>
      )}
    </main>
  );
}
