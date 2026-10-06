"use client";

import { useState } from "react";
import { CaretUp, ListBullets, Play } from "@phosphor-icons/react";
import { usePortrait } from "@/lib/screen";
import PlayerBar from "./PlayerBar";
import type { Track } from "./tracks";

/* 오른쪽 곡 목록 — 꺼낸 곡 전부를 — 제목 흰색·가수 회색, 꽂힌 곡만 파랑. 누르면 그 곡이 드라이브에 꽂혀 바로 재생된다(곡별 이유 한 줄은 10/1 사용자 요청으로 뺐다).
   목록 아래에 재생. 글자 크기는 프레임 높이(cqh)를 따라간다.
   세로 화면(폰)은 오른쪽에 둘 자리가 없다 — 디스크 줄과 드라이브 사이에 미니 플레이어 한 줄로 깔고, 목록은 접어 뒀다가 누르면 위로 펼친다 */
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
  const head = "font-mono text-[.8em] tracking-[.15em] text-accent/70";

  const list = (
    <ol className="mb-[1em] portrait:mb-0 portrait:max-h-[38cqh] portrait:overflow-y-auto portrait:border-b portrait:border-white/5 portrait:px-4 portrait:py-1">
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
              className={`flex w-full items-baseline gap-[.8em] py-[.35em] text-left transition-colors portrait:py-[.7em] ${on ? "text-accent" : "text-foreground/85 hover:text-foreground"}`}
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
  );

  /* 폰 — 음악 앱의 미니 플레이어처럼 아래 한 줄. 듣는 곡이 있으면 재생·곡·꺼내기, 없으면 "PLAYLIST n".
     오른쪽 화살표로 목록을 위로 펼친다(10/6 사용자: 폰 UI 가 엉성하다 — 제목 줄·구분선·시간 줄이 쌓여 덩어리졌다) */
  if (portrait)
    return (
      <aside className="pointer-events-auto absolute inset-x-4 bottom-[17cqh] overflow-hidden rounded-ui border border-white/10 bg-black/80 text-[14px] shadow-[0_10px_40px_rgba(0,0,0,.5)] backdrop-blur-md animate-[appear_.3s_both]">
        {open && list}
        <div className="relative flex min-h-14 items-center gap-1 pl-3">
          {playing ? (
            <PlayerBar track={playing} onEject={onEject} from={{ query }} compact />
          ) : (
            <button type="button" onClick={() => setOpen(!open)} className={`min-h-11 flex-1 text-left ${head}`}>
              {title}
            </button>
          )}
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`곡 목록 ${tracks.length}곡`} className="grid size-11 shrink-0 place-items-center text-foreground/60">
            {playing ? <ListBullets aria-hidden className="size-5" /> : <CaretUp aria-hidden weight="bold" className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />}
          </button>
        </div>
      </aside>
    );

  return (
    <aside className="pointer-events-auto absolute right-[2.5cqw] top-[14cqh] max-h-[84cqh] w-[clamp(220px,24cqw,340px)] overflow-y-auto rounded-ui border border-accent/10 bg-black/70 p-[1.2em] text-[clamp(12px,1.75cqh,15px)] shadow-[0_10px_40px_rgba(0,0,0,.5)] backdrop-blur-sm animate-[appear_.3s_both]">
      <p className={`mb-[.8em] ${head}`}>{title}</p>
      {list}
      <PlayerBar track={playing} onEject={onEject} from={{ query }} />
    </aside>
  );
}
