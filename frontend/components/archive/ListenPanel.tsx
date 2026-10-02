"use client";

import { useState } from "react";
import { PLAYLIST_DIALOGUE as D } from "@/components/landing/lines";
import { shareCard } from "@/components/share/share";
import { logEvent } from "@/lib/api";
import { thud } from "@/lib/thud";
import { playlistOf, type Playlist, type Shelf } from "./shelf";

/* 열린 서랍을 유튜브에서 이어 듣기 — 누르면 영상을 찾아(서버 서랍) 재생목록 링크를 내주고,
   못 찾은 곡·할당량이 없는 날·브라우저에만 있는 서랍은 곡별 유튜브 검색 링크로 */
export default function ListenPanel({ shelf }: { shelf: Shelf }) {
  const [state, setState] = useState<"idle" | "working" | "fail">("idle");
  const [result, setResult] = useState<Playlist | null>(null);

  async function listen() {
    thud(120);
    setState("working");
    const r = await playlistOf(shelf);
    setResult(r);
    setState(r ? "idle" : "fail");
    return r;
  }

  /* 공유 카드 — 서버 서랍이면 QR 이 공개 서랍(/s/:id)을 가리킨다(유튜브는 거기서). 브라우저에만 있는 서랍은 QR 없이 */
  const [card, setCard] = useState<"idle" | "working" | "saved" | "fail">("idle");
  async function share() {
    thud(160);
    setCard("working");
    const r = await shareCard({
      q: shelf.query || shelf.tag,
      keywords: [shelf.tag.replace(/^#/, "")],
      tracks: shelf.kept,
      link: shelf.remote ? `${location.origin}/s/${shelf.id}` : null,
    });
    setCard(r === "saved" ? "saved" : r ? "idle" : "fail");
    if (r === "shared" || r === "saved") logEvent("share", { shelfId: shelf.id });
  }
  const cardNote = card === "working" ? D.SHARING : card === "saved" ? D.SAVED : card === "fail" ? D.SHARE_FAIL : null;

  const note = !result
    ? state === "working"
      ? D.WORKING
      : state === "fail"
        ? D.FAIL
        : null
    : result.local
      ? D.LOCAL
      : result.exhausted
        ? D.TIRED
        : result.missing.length
          ? D.SOME(result.missing.length)
          : D.ALL;

  const youtube = () => logEvent("youtube", { shelfId: shelf.id });
  const link = "pointer-events-auto text-accent/80 underline-offset-4 hover:text-accent hover:underline";

  return (
    <div className="relative mx-auto mb-3 flex max-w-xl flex-col items-center gap-2 px-6 text-center font-mono text-[10px] tracking-[.15em] text-foreground/60">
      <div className="flex flex-wrap justify-center gap-2">
        {!result && (
          <button onClick={listen} disabled={state === "working"} className="pointer-events-auto rounded-full border border-accent/40 px-4 py-1.5 text-accent/90 hover:bg-accent/10 disabled:opacity-50">
            ▶ {D.ACTION}
          </button>
        )}
        <button onClick={share} disabled={card === "working"} className="pointer-events-auto rounded-full border border-accent/40 px-4 py-1.5 text-accent/90 hover:bg-accent/10 disabled:opacity-50">
          ⇪ {D.SHARE}
        </button>
      </div>
      {note && <p className="font-letter text-xs tracking-normal text-foreground/70">{note}</p>}
      {cardNote && <p className="font-letter text-xs tracking-normal text-foreground/70">{cardNote}</p>}
      {result?.url && (
        <a href={result.url} onClick={youtube} target="_blank" rel="noreferrer" className="pointer-events-auto rounded-full bg-accent/90 px-4 py-1.5 text-background hover:bg-accent">
          {D.OPEN} ↗
        </a>
      )}
      {!!result?.missing.length && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 normal-case tracking-normal">
          {result.missing.map((m) => (
            <li key={m.search}>
              <a href={m.search} onClick={youtube} target="_blank" rel="noreferrer" className={link}>
                {m.artist} · {m.title} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
