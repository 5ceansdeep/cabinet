"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { SHARED_DIALOGUE as D } from "@/components/landing/lines";
import PlayerBar from "@/components/results/PlayerBar";
import type { Track } from "@/components/results/tracks";
import { logEvent } from "@/lib/api";
import { barsOf, INK, Logo, PAPER, PAPER_IMAGE } from "./Card";
import type { PublicShelf } from "./public";
import { THERMAL_FLOPPY } from "./thermal";

/* 공유 링크로 들어온 서랍 — 공유 카드와 같은 서류함 마트 영수증(10/2 사용자). 곡 줄을 누르면 30초 미리듣기, 아래에 유튜브 이어 듣기·"나도 편지 써 보기".
   링크는 대부분 휴대폰에서 열린다 — 3D 없이 가볍게, 세로 화면 먼저. 뒤에는 카드처럼 앨범 표지를 깐다(10/2 — 넓은 화면만 깔았더니 휴대폰에선 안 보였다).
   로고·구김·바코드·감열지 플로피는 카드(Card.tsx·thermal.ts)와 같은 것. 글꼴은 page.tsx 가 next/font 변수로 건넨다 */

const MONO = "var(--font-plex), var(--font-chosun), monospace";
const SWATCH = ["#1e3a5f", "#5b3a5f", "#2f5f4a", "#6a4a2a", "#3a3f5f"];

/* 뒤에 깔리는 앨범 표지 한 줄(다섯 장) — 넓은 화면은 영수증 좌우에, 휴대폰은 화면 반씩 채워 영수증 뒤·위아래로 보인다 */
function Covers({ tracks, side }: { tracks: PublicShelf["tracks"]; side: "left" | "right" }) {
  const left = side === "left";
  const five = Array.from({ length: 5 }, (_, r) => tracks[(r + (left ? 0 : 5)) % Math.max(1, tracks.length)]);
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-y-0 flex w-1/2 flex-col justify-between py-2 lg:w-[22vw] lg:max-w-[340px] ${left ? "left-0" : "right-0"}`}>
      {five.map((t, r) => {
        const style: CSSProperties = { transform: `rotate(${[-4, 3, -2, 5, -3][r] * (left ? 1 : -1)}deg)`, background: `linear-gradient(135deg, ${SWATCH[r]}, #8ec5fc)` };
        return t?.artwork ? (
          // eslint-disable-next-line @next/next/no-img-element -- iTunes 표지
          <img key={r} src={t.artwork.replace("600x600bb", "400x400bb")} alt="" className="aspect-square w-full object-cover shadow-[0_12px_30px_rgba(0,0,0,.35)]" style={style} />
        ) : (
          <div key={r} className="aspect-square w-full shadow-[0_12px_30px_rgba(0,0,0,.35)]" style={style} />
        );
      })}
    </div>
  );
}

const Rule = () => <div className="my-3 border-t-2 border-dashed opacity-55" style={{ borderColor: INK }} />;

export default function SharedShelf({ shelf }: { shelf: PublicShelf }) {
  const [playing, setPlaying] = useState<Track | null>(null);
  const tracks: Track[] = shelf.tracks.map((t) => ({ ...t, semantic: 0, cover: "linear-gradient(135deg,#1e3a5f,#8ec5fc)" }));
  const youtube = () => logEvent("youtube", { shelfId: shelf.id });
  const stamp = "inline-flex items-center justify-center gap-2 border-2 px-4 py-2 text-[13px] tracking-[.12em] transition hover:bg-black/5"; // 영수증에 찍은 도장 같은 버튼

  return (
    <main className="h-full overflow-y-auto bg-[#1b1b1f]">
      <Covers tracks={shelf.tracks} side="left" />
      <Covers tracks={shelf.tracks} side="right" />

      <div className="relative mx-auto flex min-h-full w-full max-w-[460px] flex-col items-stretch px-4 py-8">
        {/* 영수증 — 구겨진 감열지(paper-crumple.png), 고정폭 글씨. accent 를 잉크로 바꿔 재생바(PlayerBar)도 영수증 색으로 */}
        <article
          className="flex flex-col px-6 pt-7 pb-6 text-[13.5px] leading-[1.45] shadow-[0_30px_70px_rgba(0,0,0,.55)] [word-break:keep-all]"
          style={{ backgroundColor: PAPER, backgroundImage: `url(${PAPER_IMAGE})`, backgroundSize: "100% 100%", color: INK, fontFamily: MONO, ["--accent" as string]: INK }}
        >
          <Logo display="var(--font-anton)" scale={0.5} />
          {/* eslint-disable-next-line @next/next/no-img-element -- 감열지 플로피(SVG data URL) */}
          <img src={THERMAL_FLOPPY} alt="" width={248} height={144} className="mt-3 self-center opacity-85" />

          <div className="mt-3 flex justify-between">
            <span>ORDER #{shelf.id.slice(-4).toUpperCase()}</span>
            <span>{shelf.tag}</span>
          </div>
          <p className="mt-1">“{shelf.query || shelf.tag}”</p>

          <Rule />
          <div className="flex text-[12px]">
            <span className="w-9">QTY</span>
            <span className="flex-1">ITEM</span>
            <span>PLAY</span>
          </div>
          <Rule />

          <ol>
            {tracks.map((t, i) => {
              const on = t.id === playing?.id; // 목록은 렌더마다 새로 만들어져 같은 곡이어도 객체가 다르다
              return (
                <li key={t.id}>
                  <button type="button" aria-pressed={on} onClick={() => setPlaying(on ? null : t)} className={`flex w-full py-1 text-left transition ${on ? "font-semibold" : "hover:bg-black/5"}`}>
                    <span className="w-9 shrink-0 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1 pr-3 uppercase">
                      {t.title} - {t.artist}
                    </span>
                    <span className="shrink-0" aria-hidden>
                      {on ? "❚❚" : "▶"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {playing && (
            <div className="mt-2 text-[13px]">
              <PlayerBar track={playing} onEject={() => setPlaying(null)} from={{ query: shelf.query, shelfId: shelf.id }} />
            </div>
          )}

          <Rule />
          <div className="flex justify-between">
            <span>ITEM COUNT:</span>
            <span>{tracks.length}</span>
          </div>
          <Rule />

          <div className="mt-1 flex flex-col items-stretch gap-2">
            {shelf.youtube && (
              <a href={shelf.youtube} onClick={youtube} target="_blank" rel="noreferrer" className={stamp} style={{ borderColor: INK }}>
                <span aria-hidden>▶</span> {D.YOUTUBE} <span aria-hidden>↗</span>
              </a>
            )}
            {shelf.missing.length > 0 && (
              <details className="text-center text-[12px] opacity-80">
                <summary className="cursor-pointer">{shelf.youtube ? D.SOME_MISSING(shelf.missing.length) : D.SEARCH}</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {shelf.missing.map((m) => (
                    <li key={m.search}>
                      <a href={m.search} onClick={youtube} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                        {m.artist} · {m.title} <span aria-hidden>↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* 바코드 — 카드와 같은 무늬 규칙(서랍 id 로) */}
          <div aria-hidden className="mt-5 flex h-12 justify-center">
            {barsOf(shelf.id).map((b, i) => (
              <span key={i} className="h-full" style={{ width: (b + 2) / 2, marginRight: (i * 7) % 3 === 0 ? 2 : 1, background: INK }} />
            ))}
          </div>
          <div className="mt-4 flex flex-col items-center text-[11px] tracking-[.12em]">
            <span>ALL SALES FINAL</span>
            <span>THANK YOU FOR SHOPPING AT CABINET</span>
          </div>
        </article>

        <div className="mt-8 text-center">
          <Link href="/" className="inline-flex rounded-full border border-white/25 px-6 py-2.5 font-letter text-sm transition hover:bg-white/10" style={{ color: PAPER }}>
            {D.CTA} <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
