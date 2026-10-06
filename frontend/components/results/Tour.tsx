"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RESULT_DIALOGUE } from "@/components/landing/lines";
import { usePortrait, useTouch } from "@/lib/screen";

/* 처음 결과 화면 투어 — 화면을 뿌옇게 깔고 헷갈릴 만한 곳을 차례로 비춰 설명한다(10/6 사용자: 구석 영어 한 줄 대신, 영수증 안내처럼).
   뿌연 막에 구멍(clip-path evenodd)을 내 그 자리만 또렷하게. 마지막 장에서 "다시 보지 않기"를 고르면 이 브라우저에선 다시 안 띄운다.
   투어 동안 화면은 못 누른다(구멍도) — 디스크를 눌러 재생되면 영수증 안내가 투어 위로 겹쳤다 */

const OFF = "cabinet.tour";
export function tourOff() {
  try {
    return localStorage.getItem(OFF) === "off";
  } catch {
    return false;
  }
}

/* 3D 디스크 자리 — 프레임 비율(x, y, 폭, 높이). 헤드리스 스크린샷(1440×850·393×760)으로 잰 값.
   ponytail: 카메라·디스크 크기를 바꾸면 다시 잰다 */
const AREA = {
  disc: { land: [0.42, 0.35, 0.16, 0.3], port: [0.21, 0.3, 0.58, 0.31] },
  row: { land: [0.02, 0.35, 0.71, 0.3], port: [0, 0.3, 1, 0.31] },
} as const;
const PAD = 10; // 비추는 DOM 둘레 여백
const CARD = 360; // 설명 카드 폭
const GAP = 16;
const CARD_H = 240; // 카드 높이 어림(마지막 장이 가장 길다) — 자리 고를 때만 쓴다

type Frame = { x: number; y: number; w: number; h: number; W: number; H: number };

export default function Tour({ onDone }: { onDone: () => void }) {
  const portrait = usePortrait();
  const touch = useTouch();
  const root = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [never, setNever] = useState(false);
  const [f, setF] = useState<Frame | null>(null);
  const steps = RESULT_DIALOGUE.TOUR;
  const step = steps[i];
  const last = i === steps.length - 1;

  // 비출 자리를 잰다 — 장이 바뀔 때·창 크기가 바뀔 때
  useLayoutEffect(() => {
    const measure = () => {
      const r = root.current?.getBoundingClientRect();
      if (!r) return;
      const el = "target" in step ? document.querySelector(`[data-tour="${step.target}"]`)?.getBoundingClientRect() : null;
      if (el) return setF({ x: el.left - r.left - PAD, y: el.top - r.top - PAD, w: el.width + 2 * PAD, h: el.height + 2 * PAD, W: r.width, H: r.height });
      const [fx, fy, fw, fh] = AREA["area" in step ? step.area : "disc"][portrait ? "port" : "land"];
      setF({ x: fx * r.width, y: fy * r.height, w: fw * r.width, h: fh * r.height, W: r.width, H: r.height });
    };
    measure(); // 그린 뒤 DOM 자리를 잰다
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [step, portrait]);

  const finish = () => {
    if (never)
      try {
        localStorage.setItem(OFF, "off");
      } catch {}
    onDone();
  };
  const next = () => (last ? finish() : setI(i + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === "ArrowRight") next();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  // 구멍 난 막 — 바깥 사각형과 비출 사각형을 evenodd 로
  const hole = f
    ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${f.x}px ${f.y}px, ${f.x + f.w}px ${f.y}px, ${f.x + f.w}px ${f.y + f.h}px, ${f.x}px ${f.y + f.h}px, ${f.x}px ${f.y}px)`
    : undefined;
  // 카드 자리 — 비춘 곳 아래, 안 되면 위, 안 되면 옆(곡 목록처럼 위아래로 긴 것), 그래도 안 되면 가운데.
  // 10/6: 위아래만 따지다 긴 곡 목록에서 카드가 화면 위로 밀려 잘렸다
  const cw = f ? Math.min(CARD, f.W - 2 * GAP) : CARD;
  const place = (): React.CSSProperties => {
    if (!f) return {};
    const midX = Math.max(GAP, Math.min(f.W - cw - GAP, f.x + f.w / 2 - cw / 2));
    const midY = Math.max(GAP, Math.min(f.H - CARD_H - GAP, f.y + f.h / 2 - CARD_H / 2));
    if (f.y + f.h + GAP + CARD_H < f.H) return { left: midX, top: f.y + f.h + GAP };
    if (f.y - GAP - CARD_H > 0) return { left: midX, bottom: f.H - f.y + GAP };
    if (f.x - GAP - cw > 0) return { left: f.x - GAP - cw, top: midY };
    if (f.x + f.w + GAP + cw < f.W) return { left: f.x + f.w + GAP, top: midY };
    return { left: (f.W - cw) / 2, top: (f.H - CARD_H) / 2 };
  };

  return (
    <div ref={root} role="dialog" aria-modal aria-label="화면 안내" className="pointer-events-auto absolute inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px] transition-[clip-path] duration-300 motion-reduce:transition-none" style={{ clipPath: hole }} />
      {f && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-ui ring-2 ring-accent/80 shadow-[0_0_28px_rgba(0,229,255,.35)] transition-all duration-300 motion-reduce:transition-none"
            style={{ left: f.x, top: f.y, width: f.w, height: f.h }}
          />
          <div
            key={i}
            className="absolute rounded-ui border border-white/10 bg-neutral-950/95 p-5 text-sm shadow-[0_16px_48px_rgba(0,0,0,.6)] animate-[appear_.25s_both]"
            style={{ width: cw, ...place() }}
          >
            <p className="font-mono text-[11px] tracking-[.15em] text-accent/80">
              {i + 1} / {steps.length}
            </p>
            <p className="mt-2 font-subtitle text-lg text-subtitle break-keep [text-wrap:balance]">{step.title}</p>
            <p className="mt-1.5 font-subtitle text-[15px] leading-relaxed text-foreground/80 break-keep [text-wrap:pretty]">{touch && "touch" in step ? step.touch : step.body}</p>
            {last && (
              <label className="mt-4 flex cursor-pointer items-center gap-2 font-subtitle text-foreground/75">
                <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} className="size-4 accent-accent" />
                {RESULT_DIALOGUE.TOUR_NEVER}
              </label>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              {last ? (
                <span />
              ) : (
                <button type="button" onClick={finish} className="font-subtitle text-foreground/50 transition-colors hover:text-foreground">
                  {RESULT_DIALOGUE.TOUR_SKIP}
                </button>
              )}
              <button type="button" onClick={next} autoFocus className="btn-solid">
                {last ? RESULT_DIALOGUE.TOUR_DONE : RESULT_DIALOGUE.TOUR_NEXT}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
