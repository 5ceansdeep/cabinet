"use client";

import { useState } from "react";
import { CaretUp, Play } from "@phosphor-icons/react";
import { usePortrait } from "@/lib/screen";
import PlayerBar from "./PlayerBar";
import type { Track } from "./tracks";

/* 오른쪽 곡 목록 — 꺼낸 곡 전부를 파란 글씨로. 누르면 그 곡이 드라이브에 꽂혀 바로 재생된다(곡별 이유 한 줄은 10/1 사용자 요청으로 뺐다).
   꽂힌 곡은 밝게, 목록 아래에 재생. 글자 크기는 프레임 높이(cqh)를 따라간다.
   세로 화면(폰)은 오른쪽에 둘 자리가 없다 — 디스크 줄과 드라이브 사이에 가로로 깔고, 목록은 접어 뒀다가 누르면 위로 펼친다. 재생은 늘 보인다 */
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
  const [open, setOpen] = useState(false); // 세로 화면에서 목록을 펼쳤나
  const shown = !portrait || open;
  const title = `PLAYLIST ${tracks.length}`;
  const head = "font-mono text-[.8em] tracking-[.15em] text-accent/70";

  return (
    <aside className="pointer-events-auto absolute right-[2.5cqw] top-[14cqh] w-[clamp(220px,24cqw,340px)] rounded-ui border border-accent/10 bg-black/70 p-[1.2em] text-[clamp(12px,1.75cqh,15px)] shadow-[0_10px_40px_rgba(0,0,0,.5)] backdrop-blur-sm animate-[appear_.3s_both] landscape:max-h-[84cqh] landscape:overflow-y-auto portrait:inset-x-3 portrait:top-auto portrait:bottom-[17cqh] portrait:w-auto portrait:px-[1.2em] portrait:py-[.6em]">
      {portrait ? (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`flex min-h-9 w-full items-center justify-between ${head}`}>
          {title}
          <CaretUp aria-hidden weight="bold" className={`size-[1.2em] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <p className={`mb-[.8em] ${head}`}>{title}</p>
      )}
      {shown && (
        <ol className="mb-[1em] portrait:mb-[.4em] portrait:max-h-[38cqh] portrait:overflow-y-auto">
          {tracks.map((t, i) => {
            const on = t === playing;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!on) onPick(t);
                    setOpen(false);
                  }}
                  aria-current={on}
                  className={`flex w-full items-baseline gap-[.8em] py-[.35em] text-left transition-colors portrait:py-[.65em] ${on ? "text-accent" : "text-foreground/85 hover:text-foreground"}`}
                >
                  <span className={`w-[1.6em] shrink-0 font-mono text-[.8em] tabular-nums ${on ? "" : "text-foreground/35"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {t.title} <span className={`ml-[.3em] text-[.85em] ${on ? "text-accent/70" : "text-foreground/45"}`}>{t.artist}</span>
                  </span>
                  {on && <Play aria-hidden weight="fill" className="size-[.8em] shrink-0" />}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <PlayerBar track={playing} onEject={onEject} from={{ query }} />
    </aside>
  );
}
