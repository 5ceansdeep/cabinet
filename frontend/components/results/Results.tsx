"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveShelf, suggestTag } from "@/components/archive/shelf";
import { thud } from "@/lib/thud";
import CabinetWall from "./CabinetWall";
import Riffle from "./Riffle";
import { TRACKS, type Track } from "./tracks";

/* 4·4-1번 페이지 — 서랍 속에서 건져 올린 플로피 디스크들. 디스크도 서류함도 전부 3D 이고,
   그 위에 얹힌 DOM 은 제목·보고서 링크 같은 글자뿐이다 */
export default function Results({ query }: { query: string }) {
  /* riffle 카드 넘김 → discs 고르기 → saving 서랍이 삼킴 → naming 네임택에 이름 적기 → printing 타자기로 인쇄 */
  const [phase, setPhase] = useState<"riffle" | "discs" | "saving" | "naming" | "printing">("riffle");
  const router = useRouter();
  const [tag, setTag] = useState("");
  const [printed, setPrinted] = useState(0); // 네임택에 찍힌 글자 수
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

  /* 서랍에 넣기 — 디스크가 아래 서랍으로 빨려 들고, 다 삼키면 "탁" 닫히며 네임택을 내민다 */
  function store() {
    setPhase("saving");
    setTag(suggestTag(query));
    thud(120);
    setTimeout(() => {
      thud(70);
      setPhase("naming");
    }, 1400);
  }

  /* 이름을 정했다 — 네임택에 한 글자씩 찍고 보관함으로 */
  function print() {
    const name = tag.trim() || suggestTag(query);
    setTag(name);
    setPhase("printing");
    let n = 0;
    const id = setInterval(() => {
      setPrinted(++n);
      thud(420 + (n % 3) * 40); // 타자기 소리
      if (n >= name.length) {
        clearInterval(id);
        setTimeout(() => router.push(`/archive?new=${saveShelf(name, kept)}`), 900);
      }
    }, 90);
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
          <CabinetWall
            tracks={kept}
            index={index}
            playing={playing}
            saving={phase !== "discs"}
            tag={phase === "printing" ? tag.slice(0, printed) : ""}
            onPlay={play}
            onDiscard={discard}
          />

          <header className="pointer-events-none relative flex items-start justify-between gap-4 px-6 pt-6 font-mono text-[10px] tracking-[.2em] text-foreground/50">
            <p className="max-w-xl">
              QUERY — <span className="normal-case tracking-normal text-foreground/80">{query || "(empty)"}</span>
            </p>
            <span className="flex shrink-0 gap-4">
              {phase === "discs" && kept.length > 0 && (
                <button onClick={store} className="pointer-events-auto text-accent/80 hover:text-accent">
                  서랍에 넣기
                </button>
              )}
              <Link href="/archive" className="pointer-events-auto text-accent/80 hover:text-accent">MY CABINET</Link>
              <Link href="/search" className="pointer-events-auto text-accent/80 hover:text-accent">NEW REQUEST</Link>
            </span>
          </header>

          <div className="flex-1" />

          {/* 가운데 디스크의 이름표 — 3D 디스크 아래에 놓인다 */}
          {center && phase === "discs" && (
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

          {phase === "naming" && (
            /* 네임택 — 자동으로 지어 준 이름이 적혀 있고, 그 위에서 바로 고쳐 쓸 수 있다 */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                print();
              }}
              className="relative mx-auto mb-4 flex w-fit items-center gap-3 rounded-sm border border-white/20 bg-neutral-200/90 px-4 py-2 shadow-[0_8px_30px_rgba(0,0,0,.5)]"
            >
              <input
                autoFocus
                value={tag}
                onChange={(e) => setTag(e.target.value.slice(0, 16))}
                aria-label="서랍 이름"
                className="w-44 bg-transparent text-center font-mono text-sm tracking-[.2em] text-neutral-800 outline-none"
              />
              <button type="submit" className="font-mono text-[10px] tracking-[.2em] text-neutral-600 hover:text-neutral-900">
                붙이기 ⏎
              </button>
            </form>
          )}

          <div className="relative flex items-center justify-center gap-10 pb-2">
            {phase === "discs" &&
              [-1, 1].map((dir) => (
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
