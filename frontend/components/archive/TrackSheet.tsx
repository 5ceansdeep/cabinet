"use client";

import { useEffect } from "react";
import { ARCHIVE_DIALOGUE as D, PLAYLIST_DIALOGUE as P } from "@/components/landing/lines";
import PlayerBar from "@/components/results/PlayerBar";
import type { Track } from "@/components/results/tracks";

/* 보관함에서 디스크를 누르면 — 디스크가 앞으로 나오며 큰 표지와 곡 설명(감정·상황·가사·소리)이 뜬다, 30초 미리듣기도.
   10/2 테스터: "디스크 클릭 시 앞으로 나오면서 곡 표지랑 설명서가 나오면 좋겠다". 바깥을 누르거나 ESC 로 닫는다 */
export default function TrackSheet({ track, query, shelfId, onClose }: { track: Track; query: string; shelfId: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  // "감정: [이별, 미련] 문장" → 이름표 · 핵심어 · 문장
  const notes = (track.description ?? "")
    .split("\n")
    .map((l) => /^(.+?):\s*(?:\[([^\]]*)\])?\s*(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m);

  return (
    <div onClick={onClose} className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm animate-[appear_.3s_both]">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[86cqh] w-[min(92cqw,880px)] flex-col gap-6 overflow-y-auto rounded-md border border-accent/15 bg-[#0b0f16]/95 p-6 shadow-[0_20px_50px_rgba(0,0,0,.6)] animate-[print_.5s_cubic-bezier(.2,.8,.2,1)_both] sm:flex-row"
      >
        {/* 플로피 — 결과 화면 디스크와 같은 생김새를 크게 */}
        <div className="flex w-full shrink-0 flex-col items-center rounded-lg bg-[#1c2230] px-5 pt-4 pb-5 sm:w-[300px]">
          <div className="h-[56px] w-[120px] rounded-sm bg-[#aab1bb]" />
          <div className="mt-3 w-full overflow-hidden rounded-sm bg-[#ece8dc]">
            {track.artwork ? (
              // eslint-disable-next-line @next/next/no-img-element -- iTunes 표지
              <img src={track.artwork} alt="" className="aspect-square w-full object-cover" />
            ) : (
              <div className="aspect-square w-full" style={{ background: track.cover }} />
            )}
            <p className="truncate px-2 py-1 font-mono text-[11px] text-neutral-800">{track.title}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 text-sm">
          <div>
            <p className="font-letter text-2xl text-white">{track.title}</p>
            <p className="mt-1 text-accent/80">{track.artist}</p>
          </div>
          {notes.length ? (
            <dl className="flex flex-col gap-3 leading-relaxed">
              {notes.map(([, label, keys, text]) => (
                <div key={label}>
                  <dt className="font-mono text-[10px] tracking-[.2em] text-foreground/45">
                    {label}
                    {keys && <span className="ml-2 tracking-normal text-accent/70">{keys}</span>}
                  </dt>
                  <dd className="mt-0.5 text-foreground/85">{text}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-foreground/50">{D.NO_NOTE}</p>
          )}
          <div className="mt-auto">
            <PlayerBar track={track} onEject={onClose} from={{ query, shelfId }} />
          </div>
          <button onClick={onClose} className="self-end font-mono text-[10px] tracking-[.2em] text-accent/70 hover:text-accent">
            {P.CLOSE} ✕
          </button>
        </div>
      </div>
    </div>
  );
}
