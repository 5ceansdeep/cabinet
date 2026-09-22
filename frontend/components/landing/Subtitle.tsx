"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* 영화 자막 — 줄이 제 시각(delay 초)에 하나씩 위에 나타나고, 먼저 나온 줄은 한 칸씩 아래로 밀려 내려간다.
   줄마다 반투명 회색 바탕, 흰 조선굴림체 + 얇은 검정 테두리. 부모가 대사마다 key 를 바꿔 새로 건다 */
export default function Subtitle({ timeline, link, linkDelay }: { timeline: [string, number][]; link?: { href: string; label: string }; linkDelay: number }) {
  const [count, setCount] = useState(() => timeline.filter(([, d]) => d <= 0).length); // 지금까지 나온 줄 수
  const [linked, setLinked] = useState(false);
  const sig = timeline.map(([l, d]) => `${l}@${d}`).join("|"); // 내용이 같으면 타이머를 다시 걸지 않는다

  useEffect(() => {
    const ids = timeline.map(([, d], i) => setTimeout(() => setCount((c) => Math.max(c, i + 1)), d * 1000));
    const link = setTimeout(() => setLinked(true), linkDelay * 1000);
    return () => [...ids, link].forEach(clearTimeout);
  }, [sig, linkDelay]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = timeline.slice(0, count).map(([l]) => l).reverse(); // 새 줄이 위

  return (
    <div className="flex flex-col items-center font-subtitle text-[clamp(17px,2.6vh,26px)] tracking-wide text-white [text-shadow:-1px_-1px_0_rgba(0,0,0,.85),1px_-1px_0_rgba(0,0,0,.85),-1px_1px_0_rgba(0,0,0,.85),1px_1px_0_rgba(0,0,0,.85),0_0_3px_rgba(0,0,0,.5)]">
      {lines.map((l) => (
        // 높이가 0 에서 펼쳐지며 들어와, 아래 줄들이 부드럽게 밀려난다
        <div key={l} className="overflow-hidden animate-[subline_.45s_ease-out_both]">
          <p className="mb-1.5 rounded-sm bg-neutral-800/55 px-3 py-0.5 backdrop-blur-sm">- {l}</p>
        </div>
      ))}
      {link && linked && (
        // 자막과 구분되는 버튼 — 흰 알약, 어두운 명조 글씨, 테두리 없는 자막과 달리 얇은 테두리와 그림자
        <Link
          href={link.href}
          className="pointer-events-auto mt-3 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-5 py-2 font-letter text-sm tracking-normal text-neutral-800 shadow-[0_4px_16px_rgba(0,0,0,.12)] backdrop-blur-sm transition [text-shadow:none] animate-[appear_.5s_both] hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_6px_20px_rgba(0,0,0,.16)]"
        >
          {link.label}
          <span aria-hidden className="text-neutral-400">→</span>
        </Link>
      )}
    </div>
  );
}
