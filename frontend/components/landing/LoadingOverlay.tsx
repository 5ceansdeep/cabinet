/* 2번 로딩 — 헤드폰 안내와 진행률. 마법(떠다니는 문장·후광)은 3D 씬의 Magic 이 맡는다 */
export default function LoadingOverlay({ progress }: { progress: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[12%] flex flex-col items-center gap-3 text-black/70">
      <div className="flex flex-col items-center gap-3 animate-[breathe_3s_ease-in-out_infinite]">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
          <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
          <rect x="3" y="14" width="4" height="7" rx="1.5" />
          <rect x="17" y="14" width="4" height="7" rx="1.5" />
        </svg>
        <p className="text-sm tracking-wide">Please put on your headphones.</p>
      </div>
      <p aria-live="polite" className="font-mono text-[10px] tracking-[.3em] text-black/40">
        {progress}%
      </p>
    </div>
  );
}
