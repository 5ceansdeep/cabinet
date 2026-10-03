"use client";

import { X } from "@phosphor-icons/react";
import { useDialog } from "@/lib/dialog";
import { ARCHIVE_DIALOGUE as D, PLAYLIST_DIALOGUE as P } from "@/components/landing/lines";
import PlayerBar from "@/components/results/PlayerBar";
import type { Track } from "@/components/results/tracks";

/* 보관함에서 디스크를 누르면 — 디스크가 앞으로 나오며 큰 표지와 곡 설명(감정·상황·가사·소리)이 뜬다, 30초 미리듣기도.
   10/2 테스터: "디스크 클릭 시 앞으로 나오면서 곡 표지랑 설명서가 나오면 좋겠다". 바깥을 누르거나 ESC 로 닫는다 */
export default function TrackSheet({ track, query, shelfId, onClose }: { track: Track; query: string; shelfId: string; onClose: () => void }) {
  const box = useDialog<HTMLDivElement>(onClose); // ESC·Tab 가두기·닫으면 포커스 복귀
  // "감정: [이별, 미련] 문장" → 이름표 · 핵심어 · 문장
  const notes = (track.description ?? "")
    .split("\n")
    .map((l) => /^(.+?):\s*(?:\[([^\]]*)\])?\s*(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m);

  return (
    <div onClick={onClose} className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm animate-[appear_.3s_both]">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-sheet-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[86cqh] w-[min(92cqw,880px)] flex-col gap-6 overflow-y-auto rounded-ui border border-accent/15 bg-[#0b0f16]/95 p-6 shadow-[0_20px_50px_rgba(0,0,0,.6)] animate-[print_.5s_cubic-bezier(.2,.8,.2,1)_both] sm:flex-row"
      >
        {/* 플로피 — 결과 화면 디스크와 같은 생김새를 크게 */}
        <div className="flex w-full shrink-0 flex-col items-center rounded-ui bg-[#1c2230] px-6 pt-4 pb-6 sm:w-[300px]">
          <div className="h-[56px] w-[120px] rounded-sm bg-[#aab1bb]" />
          <div className="mt-3 w-full overflow-hidden rounded-sm bg-[#ece8dc]">
            {track.artwork ? (
              // eslint-disable-next-line @next/next/no-img-element -- iTunes 표지
              <img src={track.artwork} alt="" className="aspect-square w-full object-cover" />
            ) : (
              <div className="aspect-square w-full" style={{ background: track.cover }} />
            )}
            <p className="truncate px-2 py-1 font-mono text-xs text-neutral-800">{track.title}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 text-sm">
          <div>
            <h2 id="track-sheet-title" className="font-letter text-2xl text-foreground">{track.title}</h2>
            <p className="mt-1 text-accent/85">{track.artist}</p>
          </div>
          {notes.length ? (
            <dl className="flex flex-col gap-3 leading-relaxed">
              {notes.map(([, label, keys, text]) => (
                <div key={label}>
                  <dt className="font-mono text-xs tracking-[.15em] text-foreground/65">
                    {label}
                    {keys && <span className="ml-2 tracking-normal text-accent/85">{keys}</span>}
                  </dt>
                  <dd className="mt-1 text-foreground/85">{text}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-foreground/70">{D.NO_NOTE}</p>
          )}
          <div className="mt-auto">
            <PlayerBar track={track} onEject={onClose} from={{ query, shelfId }} />
          </div>
          <button type="button" onClick={onClose} className="btn self-end">
            {P.CLOSE}
            <X aria-hidden size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
