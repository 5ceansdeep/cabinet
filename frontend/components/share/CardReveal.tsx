"use client";

import { useEffect, useState } from "react";
import { ArrowRight, DownloadSimple } from "@phosphor-icons/react";
import { useDialog } from "@/lib/dialog";
import { CARD_DIALOGUE as D } from "@/components/landing/lines";
import { logEvent } from "@/lib/api";
import { thud } from "@/lib/thud";
import type { ShareData } from "./Card";

/* 서랍에 넣고 나면(결과 화면)·보관함에서 공유 카드를 누르면 — 공유 카드가 영수증처럼 인쇄돼 올라온다. 진짜 이미지(img)라 휴대폰은 길게 눌러, PC 는 우클릭으로 저장된다.
   옆에 사진 다운로드·링크 복사(서버 서랍만 — 공개 링크 /s/:id)·보관함으로(보관함에선 닫기).
   다운로드는 공유 창(navigator.share)을 거치지 않는다 — 10/3 사용자: 스토리 올리기 대신 사진 저장으로(PC 웨일·엣지는 공유 창이 거부되기도 했다).
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

  function download() {
    if (!card) return;
    logEvent("share", { shelfId });
    const a = document.createElement("a");
    a.href = card.url;
    a.download = card.file.name;
    a.click();
  }

  async function copy() {
    if (!link) return;
    logEvent("share", { shelfId });
    await navigator.clipboard.writeText(link).catch(() => undefined);
    setCopied(true);
  }

  const box = useDialog<HTMLDivElement>(onDone); // ESC = 보관함으로(보관함에선 닫기), Tab 은 카드 안에서만

  return (
    <div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label={D.TITLE}
      tabIndex={-1}
      className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black/75 px-4 backdrop-blur-sm animate-[appear_.3s_both] sm:flex-row sm:gap-12"
    >
      <div className="flex h-[78cqh] max-h-[78cqh] items-end overflow-hidden">
        {card ? (
          // eslint-disable-next-line @next/next/no-img-element -- 길게 눌러 저장하려면 진짜 img 여야 한다
          <img src={card.url} alt="공유 카드" className="h-full w-auto rounded-ui shadow-[0_20px_60px_rgba(0,0,0,.7)] animate-[print_1.1s_cubic-bezier(.2,.8,.2,1)_both]" />
        ) : (
          <div className="flex aspect-[9/16] h-full items-center justify-center rounded-ui border border-white/10 font-letter text-sm text-foreground/70">
            {failed ? D.FAIL : D.PRINTING}
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-3 sm:items-start">
        {/* 다 찍히면 말없이 카드만(10/2 사용자 — "증명서네" 대사 뺌). 찍는 중·실패만 알린다 */}
        {!card && (
          <p className="font-subtitle text-[clamp(15px,calc(.9vw+6px),26px)] text-subtitle [text-shadow:-1.5px_-1.5px_0_#0a0d14,1.5px_-1.5px_0_#0a0d14,-1.5px_1.5px_0_#0a0d14,1.5px_1.5px_0_#0a0d14]">
            {failed ? D.FAIL : D.PRINTING}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2 sm:flex-col sm:items-stretch">
          <button type="button" onClick={download} disabled={!card} className="btn-solid">
            <DownloadSimple aria-hidden size={14} weight="bold" />
            {D.DOWNLOAD}
          </button>
          {link && (
            <button type="button" onClick={copy} className="btn" aria-live="polite">
              {copied ? D.COPIED : D.COPY}
            </button>
          )}
          <button type="button" onClick={onDone} className="btn">
            {doneLabel ?? D.ARCHIVE}
            {!doneLabel && <ArrowRight aria-hidden size={14} weight="bold" />}
          </button>
        </div>
      </div>
    </div>
  );
}
