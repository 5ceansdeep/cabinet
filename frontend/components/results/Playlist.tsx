"use client";

import PlayerBar from "./PlayerBar";
import type { Track } from "./tracks";

/* 오른쪽 곡 목록 — 꺼낸 곡 전부를 파란 글씨로. 누르면 그 곡이 드라이브에 꽂혀 바로 재생된다(곡별 이유 한 줄은 10/1 사용자 요청으로 뺐다).
   꽂힌 곡은 밝게, 목록 아래에 재생. 글자 크기는 프레임 높이(cqh)를 따라간다 */
export default function Playlist({
  tracks,
  playing,
  onPick,
  onEject,
}: {
  tracks: Track[];
  playing: Track | null;
  onPick: (t: Track) => void;
  onEject: () => void;
}) {
  return (
    <aside className="pointer-events-auto absolute right-[2.5cqw] top-[14cqh] w-[clamp(220px,24cqw,340px)] rounded-md border border-accent/10 bg-black/65 p-[1.2em] text-[clamp(11px,1.75cqh,15px)] shadow-[0_10px_40px_rgba(0,0,0,.5)] backdrop-blur-sm animate-[appear_.5s_both]">
      <p className="mb-[.8em] font-mono text-[.7em] tracking-[.25em] text-accent/50">PLAYLIST — {tracks.length}</p>
      <ol className="mb-[1em]">
        {tracks.map((t, i) => {
          const on = t === playing;
          return (
            <li key={t.id}>
              <button
                onClick={() => !on && onPick(t)}
                aria-current={on}
                className={`flex w-full items-baseline gap-[.8em] py-[.35em] text-left transition-colors ${on ? "text-accent" : "text-accent/55 hover:text-accent/90"}`}
              >
                <span className="w-[1.6em] shrink-0 font-mono text-[.75em] tabular-nums opacity-70">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate">
                  {t.title} <span className="text-[.85em] opacity-60">· {t.artist}</span>
                </span>
                {on && <span aria-hidden className="shrink-0 text-[.7em]">▶</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <PlayerBar track={playing} onEject={onEject} />
    </aside>
  );
}
