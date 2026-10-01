"use client";

import Link from "next/link";
import { useState } from "react";
import { SHARED_DIALOGUE as D } from "@/components/landing/lines";
import PlayerBar from "@/components/results/PlayerBar";
import type { Track } from "@/components/results/tracks";
import type { PublicShelf } from "./public";

/* 공유 링크로 들어온 서랍 — 편지 문장, 네임택, 곡 목록(누르면 30초 미리듣기), 유튜브 이어 듣기, "나도 편지 써 보기".
   링크는 대부분 휴대폰에서 열린다 — 3D 없이 가볍게, 세로 화면 먼저 */
export default function SharedShelf({ shelf }: { shelf: PublicShelf }) {
  const [playing, setPlaying] = useState<Track | null>(null);
  const tracks: Track[] = shelf.tracks.map((t) => ({ ...t, semantic: 0, cover: "linear-gradient(135deg,#1e3a5f,#8ec5fc)" }));

  return (
    <main data-theme="void" className="h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-6 py-10">
        <header className="flex items-center justify-between font-mono text-[10px] tracking-[.3em] text-foreground/45">
          <Link href="/" className="hover:text-foreground/80">
            CABINET
          </Link>
          <span className="text-accent/80">{shelf.tag}</span>
        </header>

        <p className="mt-10 font-letter text-sm text-foreground/50">{D.INTRO}</p>
        <h1 className="mt-3 font-letter text-2xl leading-snug text-white sm:text-3xl">“{shelf.query || shelf.tag}”</h1>

        <ol className="mt-8 rounded-md border border-accent/10 bg-black/40 p-4">
          {tracks.map((t, i) => {
            const on = t === playing;
            return (
              <li key={t.id}>
                <button
                  onClick={() => setPlaying(on ? null : t)}
                  className={`flex w-full items-center gap-3 py-2 text-left transition-colors ${on ? "text-accent" : "text-accent/60 hover:text-accent/90"}`}
                >
                  <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums opacity-70">{String(i + 1).padStart(2, "0")}</span>
                  {t.artwork ? (
                    // eslint-disable-next-line @next/next/no-img-element -- iTunes 표지, 작은 썸네일
                    <img src={t.artwork.replace("600x600bb", "100x100bb")} alt="" className="size-9 shrink-0 rounded-sm object-cover" />
                  ) : (
                    <span className="size-9 shrink-0 rounded-sm" style={{ background: t.cover }} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{t.title}</span>
                    <span className="block truncate text-xs opacity-60">{t.artist}</span>
                  </span>
                  {on && <span className="text-xs">▶</span>}
                </button>
              </li>
            );
          })}
        </ol>

        {playing && (
          <div className="mt-4 text-sm">
            <PlayerBar track={playing} onEject={() => setPlaying(null)} />
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          {shelf.youtube && (
            <a href={shelf.youtube} target="_blank" rel="noreferrer" className="rounded-full bg-accent/90 px-5 py-2 font-mono text-xs tracking-[.15em] text-background hover:bg-accent">
              ▶ {D.YOUTUBE} ↗
            </a>
          )}
          {shelf.missing.length > 0 && (
            <details className="w-full text-center text-xs text-foreground/50">
              <summary className="cursor-pointer">{shelf.youtube ? D.SOME_MISSING(shelf.missing.length) : D.SEARCH}</summary>
              <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                {shelf.missing.map((m) => (
                  <li key={m.search}>
                    <a href={m.search} target="_blank" rel="noreferrer" className="text-accent/70 hover:text-accent">
                      {m.artist} · {m.title} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="mt-auto pt-12 text-center">
          <Link href="/" className="inline-flex rounded-full border border-white/20 px-6 py-2.5 font-letter text-sm text-white/85 transition hover:bg-white/10">
            {D.CTA} →
          </Link>
        </div>
      </div>
    </main>
  );
}
