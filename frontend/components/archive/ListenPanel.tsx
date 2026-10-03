"use client";

import { ArrowUpRight, Play, ShareFat } from "@phosphor-icons/react";
import { useState } from "react";
import { PLAYLIST_DIALOGUE as D } from "@/components/landing/lines";
import { logEvent } from "@/lib/api";
import { thud } from "@/lib/thud";
import { playlistOf, type Playlist, type Shelf } from "./shelf";

/* 열린 서랍을 유튜브에서 이어 듣기 — 누르면 영상을 찾아(서버 서랍) 재생목록 링크를 내주고,
   못 찾은 곡·할당량이 없는 날·브라우저에만 있는 서랍은 곡별 유튜브 검색 링크로 */
export default function ListenPanel({ shelf, onShare }: { shelf: Shelf; onShare: () => void }) {
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

  /* 공유 카드 — 결과 화면과 같은 카드 화면(CardReveal)을 보관함이 띄운다. 10/2 테스터 버그: 여기서 카드를 다 그린 뒤(5~9초) 공유 창을 불렀더니
     클릭이 만료돼 브라우저가 공유 창을 거부했고, 그걸 "닫음"으로 잘못 받아 아무 일도 안 일어났다 */

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
  const link = "pointer-events-auto text-accent/85 underline underline-offset-4 hover:text-accent";

  return (
    <div className="relative mx-auto mb-4 flex max-w-xl flex-col items-center gap-2 px-6 text-center font-mono text-xs tracking-[.15em] text-foreground/70">
      <div className="flex flex-wrap justify-center gap-2">
        {!result && (
          <button type="button" onClick={listen} disabled={state === "working"} className="btn pointer-events-auto">
            <Play aria-hidden weight="fill" size={12} />
            {D.ACTION}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            thud(160);
            onShare();
          }}
          className="btn pointer-events-auto">
          <ShareFat aria-hidden size={14} />
          {D.SHARE}
        </button>
      </div>
      {note && <p className="font-letter text-xs tracking-normal text-foreground/70">{note}</p>}
      {result?.url && (
        <a href={result.url} onClick={youtube} target="_blank" rel="noreferrer" className="btn-solid pointer-events-auto">
          {D.OPEN}
          <ArrowUpRight aria-hidden size={14} weight="bold" />
        </a>
      )}
      {!!result?.missing.length && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 normal-case tracking-normal">
          {result.missing.map((m) => (
            <li key={m.search}>
              <a href={m.search} onClick={youtube} target="_blank" rel="noreferrer" className={link}>
                {m.artist} · {m.title}
                <ArrowUpRight aria-hidden size={12} className="ml-1 inline" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
