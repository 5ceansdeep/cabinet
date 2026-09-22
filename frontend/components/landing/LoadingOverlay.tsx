import { CABINET_TOP } from "./dimensions";

/* 흰 핵 + 불규칙한 빛살(주기가 다른 원뿔 그라디언트 두 겹) — 가장자리는 마스크로 흩어진다 */
const BURST = [
  "radial-gradient(circle, #fff 0 14%, rgba(255,255,255,.95) 20%, rgba(255,255,255,.5) 28%, rgba(255,255,255,0) 42%)",
  "repeating-conic-gradient(#fff 0deg .8deg, rgba(255,255,255,0) 1.6deg 3.1deg)",
  "repeating-conic-gradient(from 1deg, #fff 0deg .6deg, rgba(255,255,255,0) 1.3deg 4.7deg)",
].join(",");
const FADE = "radial-gradient(circle, #000 14%, transparent 58%)";

/* 2번 로딩 — 서류함 뒤에서 흰 빛살이 터지듯 비치고, 점점 밝아지다 화면 전체를 하얗게 덮는다.
   behind(빛살)는 캔버스(투명 배경) 뒤, 앞쪽 흰 빛은 캔버스 위. 흰 배경에서 흰 빛이 보이게 뒤에 옅은 그림자색을 깐다. p = 0..1 */
export function Halo({ p, behind }: { p: number; behind?: boolean }) {
  if (behind)
    return (
      <>
        <div aria-hidden className="absolute inset-0 bg-[#dee2e6] transition-opacity duration-700" style={{ opacity: Math.min(1, p * 4) }} />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -m-[50vmax] size-[100vmax] animate-[turn_90s_linear_infinite] transition-[transform,opacity] duration-700 ease-out"
          style={{
            top: `${CABINET_TOP}%`,
            transform: `scale(${0.7 + p * 1.8})`, // translate 대신 margin 으로 가운데 — rotate 가 제자리에서 돌게
            opacity: Math.min(1, p * 8),            background: BURST,
            maskImage: FADE,
          }}
        />
      </>
    );
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 size-[100vmax] rounded-full transition-[transform,opacity] duration-700 ease-out"
      style={{
        top: `${CABINET_TOP}%`,
        transform: `translate(-50%, -50%) scale(${0.2 + 6 * p ** 3})`,
        opacity: p ** 2,
        background: "radial-gradient(circle, #fff 0 30%, rgba(255,255,255,0) 70%)",
      }}
    />
  );
}

/* 헤드폰 안내 — 화면 가운데서 한 번 페이드 인/아웃. 진행률은 아래에 조용히 */
export default function LoadingOverlay({ progress }: { progress: number }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-black/70 animate-[fadeinout_3.5s_.7s_ease-in-out_both]">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
          <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
          <rect x="3" y="14" width="4" height="7" rx="1.5" />
          <rect x="17" y="14" width="4" height="7" rx="1.5" />
        </svg>
        <p className="text-sm tracking-wide">Please put on your headphones.</p>
      </div>
      <p aria-live="polite" className="absolute inset-x-0 bottom-8 text-center font-mono text-[10px] tracking-[.3em] text-black/40">
        {progress}%
      </p>
    </>
  );
}
