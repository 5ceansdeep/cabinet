"use client";

import { useState } from "react";
import { CaretUp, Waveform } from "@phosphor-icons/react";
import { usePortrait } from "@/lib/screen";
import LikeButton from "./LikeButton";
import PlayerBar from "./PlayerBar";
import type { Track } from "./tracks";

/* 곡 목록 + 재생 카드 — 꺼낸 곡 전부. 누르면 그 곡이 드라이브에 꽂혀 바로 재생된다(곡별 이유 한 줄은 10/1 사용자 요청으로 뺐다).
   한 줄 = 작은 표지 + 제목·가수 두 줄, 듣는 곡은 은은한 바탕에 시안 글씨(10/6 사용자: 목록·재생바가 안 예쁘다 — 레퍼런스처럼).
   데스크톱은 오른쪽 패널(글자 크기는 프레임 높이 cqh 를 따라간다), 세로 화면(폰)은 아래에 깔고 목록은 접어 뒀다가 위로 펼친다 */
export default function Playlist({
  tracks,
  playing,
  onPick,
  onEject,
  query,
}: {
  query: string;
  tracks: Track[];
  playing: Track | null;
  onPick: (t: Track) => void;
  onEject: () => void;
}) {
  const portrait = usePortrait();
  const [open, setOpen] = useState(false); // 폰에서 목록을 펼쳤나
  const title = `PLAYLIST ${tracks.length}`;
  const head = "font-mono text-[.75em] tracking-[.15em] text-accent/70";
  const at = playing ? tracks.findIndex((t) => t.id === playing.id) : -1;
  const step = (d: number) => (tracks[at + d] ? () => onPick(tracks[at + d]) : undefined);

  const list = (
    <ol className="mx-[-0.4em] portrait:mx-0 portrait:max-h-[38cqh] portrait:overflow-y-auto portrait:px-[.4em] portrait:pb-[.4em]">
      {tracks.map((t, i) => {
        const on = t.id === playing?.id;
        return (
          <li key={t.id} className="flex items-center">
            <button
              type="button"
              onClick={() => {
                if (!on) onPick(t);
                setOpen(false);
              }}
              aria-current={on}
              className={`flex min-w-0 flex-1 items-center gap-[.75em] rounded-[.6em] px-[.4em] py-[.35em] text-left transition-colors ${on ? "bg-accent/10" : "hover:bg-white/5"}`}
            >
              {/* 순위 — 추천 순서(10/6 사용자) */}
              <span className={`w-[1.4em] shrink-0 text-center font-mono text-[.8em] tabular-nums ${on ? "text-accent" : "text-foreground/35"}`}>{i + 1}</span>
              <span className="relative size-[2.4em] shrink-0 overflow-hidden rounded-[.35em] bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element -- iTunes 표지 */}
                {t.artwork && <img src={t.artwork} alt="" loading="lazy" className="size-full object-cover" />}
                {on && (
                  <span className="absolute inset-0 grid place-items-center bg-black/55 text-accent">
                    <Waveform aria-hidden weight="bold" className="size-[1.1em]" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className={`block truncate ${on ? "text-accent" : "text-foreground/90"}`}>{t.title}</span>
                <span className={`mt-[.15em] block truncate text-[.8em] ${on ? "text-accent/60" : "text-foreground/45"}`}>{t.artist}</span>
              </span>
            </button>
            <LikeButton trackId={t.id} query={query} />
          </li>
        );
      })}
    </ol>
  );
  const card = <PlayerBar card track={playing} onEject={onEject} onPrev={step(-1)} onNext={step(1)} from={{ query }} />;

  if (portrait)
    return (
      <aside data-tour="playlist" className="pointer-events-auto absolute inset-x-4 bottom-[15cqh] flex flex-col gap-2 text-[14px] animate-[appear_.3s_both]">
        <div className="overflow-hidden rounded-[1.1em] border border-white/10 bg-black/80 backdrop-blur-md">
          {/* 접힌 줄 — 겹친 표지 석 장 + 곡 수·첫 곡들(10/6 사용자: 글자만 있는 상자가 밋밋하다) */}
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-14 w-full items-center gap-3 py-2 pr-3 pl-2.5 text-left">
            <span className="flex shrink-0">
              {tracks.slice(0, 3).map((t, n) => (
                <span key={t.id} className={`size-9 overflow-hidden rounded-md bg-white/5 ring-2 ring-black ${n ? "-ml-4" : ""}`} style={{ zIndex: 3 - n }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- iTunes 표지 */}
                  {t.artwork && <img src={t.artwork} alt="" className="size-full object-cover" />}
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className={`block ${head}`}>{title}</span>
              <span className="mt-0.5 block truncate text-[13px] text-foreground/60">{tracks.slice(0, 3).map((t) => t.title).join(" · ")}</span>
            </span>
            <CaretUp aria-hidden weight="bold" className={`size-4 shrink-0 text-foreground/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
          {open && list}
        </div>
        {playing && <div className="rounded-[1.1em] bg-black/70 backdrop-blur-md">{card}</div>}
      </aside>
    );

  return (
    <aside data-tour="playlist" className="pointer-events-auto absolute right-[2.5cqw] top-[14cqh] flex max-h-[80cqh] w-[clamp(240px,25cqw,360px)] flex-col rounded-[1.1em] border border-white/10 bg-black/70 p-[1em] text-[clamp(12px,1.75cqh,15px)] shadow-[0_10px_40px_rgba(0,0,0,.5)] backdrop-blur-md animate-[appear_.3s_both]">
      <p className={`mb-[.6em] px-[.1em] ${head}`}>{title}</p>
      <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
      {playing && <div className="mt-[.9em]">{card}</div>}
    </aside>
  );
}
