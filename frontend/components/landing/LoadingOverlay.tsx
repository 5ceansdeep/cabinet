/* 2번 로딩 — 헤드폰 안내 + 서류 고속 분류하듯 올라가는 시스템 로그 */
export default function LoadingOverlay({ logs, progress }: { logs: string[]; progress: number }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 animate-[breathe_3s_ease-in-out_infinite]">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
          <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
          <rect x="3" y="14" width="4" height="7" rx="1.5" />
          <rect x="17" y="14" width="4" height="7" rx="1.5" />
        </svg>
        <p className="text-sm tracking-wide">Please put on your headphones.</p>
      </div>
      <div
        aria-live="polite"
        className="pointer-events-none absolute right-6 bottom-6 flex h-1/2 w-72 flex-col justify-end overflow-hidden font-mono text-[10px] leading-4 text-black/40 [mask-image:linear-gradient(transparent,#000_40%)]"
      >
        {logs.map((l, i) => (
          <p key={i} className="truncate">{l}</p>
        ))}
        <p className="mt-1 text-black/70">{progress}%</p>
      </div>
    </>
  );
}
