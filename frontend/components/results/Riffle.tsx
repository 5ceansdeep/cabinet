/* Bruce Almighty 오마주 — 수백 장의 음악 카드 서류가 촤르르륵 스쳐 지나가다 딱 멈춘다 */
export default function Riffle() {
  return (
    <div className="absolute inset-0 flex justify-center [mask-image:linear-gradient(transparent,#000_20%,#000_80%,transparent)] [perspective:700px]" aria-hidden>
      <div className="w-[min(90vw,520px)] animate-[riffle_1.6s_cubic-bezier(.3,.1,.2,1)_forwards]">
        {Array.from({ length: 60 }, (_, i) => (
          <div key={i} className="mb-2 flex h-20 items-start rounded-sm bg-data-surface px-4 pt-2 font-mono text-[10px] text-foreground/40 [transform:rotateX(-45deg)]">
            <span className="rounded-t-sm bg-foreground/10 px-2">No. {String(i * 131 + 768).padStart(5, "0")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
