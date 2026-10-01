"use client";

import { useEffect, useState } from "react";
import { CARD_DIALOGUE as D } from "@/components/landing/lines";
import { thud } from "@/lib/thud";
import type { ShareData } from "./Card";

/* 서랍에 넣고 나면 — 공유 카드가 영수증처럼 인쇄돼 올라온다. 진짜 이미지(img)라 휴대폰은 길게 눌러, PC 는 우클릭으로 저장된다.
   옆에 스토리에 올리기(공유 창)·링크 복사(서버 서랍만 — 공개 링크 /s/:id)·보관함으로 */
export default function CardReveal({ data, shelfId, remote, onDone }: { data: Omit<ShareData, "link">; shelfId: string; remote: boolean; onDone: () => void }) {
  const [card, setCard] = useState<{ url: string; file: File } | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [link] = useState(() => (remote ? `${location.origin}/s/${shelfId}` : null));

  // 카드 인쇄 — 한 번만
  useEffect(() => {
    let url = "";
    void fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, link }) })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const file = new File([await r.blob()], "cabinet.png", { type: "image/png" });
        url = URL.createObjectURL(file);
        thud(300); // 인쇄 끝 — "착"
        setCard({ url, file });
      })
      .catch(() => setFailed(true));
    return () => URL.revokeObjectURL(url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 서랍에 넣을 때 한 번

  async function story() {
    if (!card) return;
    if (navigator.canShare?.({ files: [card.file] })) {
      await navigator.share({ files: [card.file], title: "cabinet", url: link ?? undefined }).catch(() => undefined);
      return;
    }
    const a = document.createElement("a"); // 공유 창이 없으면(PC) 내려받기
    a.href = card.url;
    a.download = "cabinet.png";
    a.click();
  }

  async function copy() {
    if (!link) return;
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
        <p className="font-subtitle text-[clamp(15px,calc(.9vw+6px),26px)] text-[#f3da49] [text-shadow:-1.5px_-1.5px_0_#000,1.5px_-1.5px_0_#000,-1.5px_1.5px_0_#000,1.5px_1.5px_0_#000]">
          {card ? D.READY : failed ? D.FAIL : D.PRINTING}
        </p>
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
            {D.ARCHIVE} →
          </button>
        </div>
      </div>
    </div>
  );
}
