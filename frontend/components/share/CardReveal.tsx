"use client";

import { useEffect, useState } from "react";
import { CARD_DIALOGUE as D } from "@/components/landing/lines";
import { logEvent } from "@/lib/api";
import { thud } from "@/lib/thud";
import type { ShareData } from "./Card";

/* 서랍에 넣고 나면(결과 화면)·보관함에서 공유 카드를 누르면 — 공유 카드가 영수증처럼 인쇄돼 올라온다. 진짜 이미지(img)라 휴대폰은 길게 눌러, PC 는 우클릭으로 저장된다.
   옆에 스토리에 올리기(공유 창)·링크 복사(서버 서랍만 — 공개 링크 /s/:id)·보관함으로(보관함에선 닫기).
   서버 서랍은 GET /api/share/:id — 서랍에 남긴 그대로 같은 카드, 한 번 그린 건 Vercel 이 기억해 다시 볼 땐 바로 뜬다 */
export default function CardReveal({
  data,
  shelfId,
  remote,
  onDone,
  doneLabel,
}: {
  data: Omit<ShareData, "link">;
  shelfId: string;
  remote: boolean;
  onDone: () => void;
  doneLabel?: string;
}) {
  const [card, setCard] = useState<{ url: string; file: File } | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [link] = useState(() => (remote ? `${location.origin}/s/${shelfId}` : null));

  // 카드 인쇄 — 한 번만
  useEffect(() => {
    let url = "";
    void (remote ? fetch(`/api/share/${encodeURIComponent(shelfId)}`) : fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, link }) }))
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const file = new File([await r.blob()], "cabinet.png", { type: "image/png" });
        url = URL.createObjectURL(file);
        thud(300); // 인쇄 끝 — "착"
        setCard({ url, file });
      })
      .catch(() => setFailed(true));
    return () => URL.revokeObjectURL(url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 띄울 때 한 번

  async function story() {
    if (!card) return;
    logEvent("share", { shelfId });
    if (navigator.canShare?.({ files: [card.file] })) {
      // 사용자가 닫으면(AbortError) 그만, 브라우저가 공유 창을 거부하면(NotAllowedError 등) 내려받기로 — 10/2 PC 웨일·엣지에서 아무 일도 안 일어났다
      const err = await navigator.share({ files: [card.file], title: "cabinet", url: link ?? undefined }).then(() => null, (e: Error) => e);
      if (!err || err.name === "AbortError") return;
    }
    const a = document.createElement("a"); // 공유 창이 없거나 거부되면(PC) 내려받기
    a.href = card.url;
    a.download = "cabinet.png";
    a.click();
  }

  async function copy() {
    if (!link) return;
    logEvent("share", { shelfId });
    await navigator.clipboard.writeText(link).catch(() => undefined);
    setCopied(true);
  }

  const btn = "rounded-full border border-accent/40 px-5 py-2 font-mono text-xs tracking-[.15em] text-accent/90 transition hover:bg-accent/10 disabled:opacity-40";

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-[2.5cqh] bg-black/75 px-4 backdrop-blur-sm animate-[appear_.4s_both] sm:flex-row sm:gap-[4cqw]">
      <div className="flex h-[78cqh] max-h-[78cqh] items-end overflow-hidden">
        {card ? (
          // eslint-disable-next-line @next/next/no-img-element -- 길게 눌러 저장하려면 진짜 img 여야 한다
          <img src={card.url} alt="공유 카드" className="h-full w-auto rounded-md shadow-[0_20px_60px_rgba(0,0,0,.7)] animate-[print_1.1s_cubic-bezier(.2,.8,.2,1)_both]" />
        ) : (
          <div className="flex aspect-[9/16] h-full items-center justify-center rounded-md border border-white/10 font-letter text-sm text-foreground/50">
            {failed ? D.FAIL : D.PRINTING}
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-3 sm:items-start">
        {/* 다 찍히면 말없이 카드만(10/2 사용자 — "증명서네" 대사 뺌). 찍는 중·실패만 알린다 */}
        {!card && (
          <p className="font-subtitle text-[clamp(15px,calc(.9vw+6px),26px)] text-[#e2cd5a] [text-shadow:-1.5px_-1.5px_0_#000,1.5px_-1.5px_0_#000,-1.5px_1.5px_0_#000,1.5px_1.5px_0_#000]">
            {failed ? D.FAIL : D.PRINTING}
          </p>
        )}
        {card && <p className="font-mono text-[10px] tracking-[.2em] text-foreground/40">{D.HOLD}</p>}
        <div className="flex flex-wrap justify-center gap-2 sm:flex-col sm:items-stretch">
          <button onClick={story} disabled={!card} className={btn}>
            ⇪ {D.STORY}
          </button>
          {link && (
            <button onClick={copy} className={btn}>
              {copied ? D.COPIED : D.COPY}
            </button>
          )}
          <button onClick={onDone} className={btn}>
            {doneLabel ?? `${D.ARCHIVE} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
