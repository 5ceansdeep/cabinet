"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

/* 긴 자막은 영화처럼 문장마다 줄을 나눈다 ("- 첫 문장" / "- 다음 문장"). "땡." 같은 짧은 조각은 다음 문장에 붙인다 */
export function subtitleLines(text: string) {
  if (text.length <= 18) return [text];
  const parts = text.match(/[^.?!]+[.?!]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  return parts.reduce<string[]>((out, s) => {
    const last = out.at(-1);
    if (last && last.length < 6) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
    return out;
  }, []);
}

/* 줄마다 뜨는 시각(초). 음성 파일이 있으면 그 파일에서 찾은 문장 시작 시각에 맞추고(cues — 문장 수가 줄 수와 같을 때),
   없으면 앞 줄을 읽을 만큼 글자 수에 비례해 기다린다 */
export const LINE_PACE = 0.09; // 글자당 초
const HOLD_S = 3; // 대사가 끝나고 자막이 남아 있는 시간(초)
export function subtitleDelays(text: string, cues?: number[]) {
  const lines = subtitleLines(text);
  if (cues?.length === lines.length) return lines.map((l, i): [string, number] => [l, Math.max(0, cues[i])]);
  let chars = 0;
  return lines.map((l): [string, number] => {
    const delay = chars * LINE_PACE;
    chars += l.length;
    return [l, delay];
  });
}

/* 영화 자막 — 줄이 제 시각(delay 초)에 하나씩 위에 나타나고, 먼저 나온 줄은 한 칸씩 아래로 밀려 내려간다.
   바탕 없이 노란 조선굴림체 + 검정 테두리(영화 자막처럼, 10/1 — 흰색은 밝은 서랍 벽에 묻혔다).
   글자 크기는 화면 폭을 따라간다(자막 띠는 프레임 밖이라 cq 단위가 안 먹는다). 부모가 대사마다 key 를 바꿔 새로 건다 */
const OUTLINE = [
  [-1.5, -1.5],
  [0, -1.5],
  [1.5, -1.5],
  [-1.5, 0],
  [1.5, 0],
  [-1.5, 1.5],
  [0, 1.5],
  [1.5, 1.5],
]
  .map(([x, y]) => `${x}px ${y}px 0 #000`)
  .join(",");
export default function Subtitle({ timeline, link, linkDelay }: { timeline: [string, number][]; link?: { href: string; label: string }; linkDelay: number }) {
  const [count, setCount] = useState(() => timeline.filter(([, d]) => d <= 0).length); // 지금까지 나온 줄 수
  const [linked, setLinked] = useState(false);
  const boil = `boil${useId().replace(/:/g, "")}`; // 자글자글 필터 id — 자막이 여러 개 떠도 안 겹치게
  const [gone, setGone] = useState(false); // 대사가 끝나고 HOLD_S 초 — 자막 줄만 사라진다(버튼은 남는다)
  const sig = timeline.map(([l, d]) => `${l}@${d}`).join("|"); // 내용이 같으면 타이머를 다시 걸지 않는다

  useEffect(() => {
    const ids = timeline.map(([, d], i) => setTimeout(() => setCount((c) => Math.max(c, i + 1)), d * 1000));
    const link = setTimeout(() => setLinked(true), linkDelay * 1000);
    // 대사 끝 = 마지막 줄이 뜬 시각 + 그 줄을 읽는 시간. ponytail: 음성 길이가 아니라 글자 수로 어림한다
    const [last, at] = timeline.at(-1) ?? ["", 0];
    const hide = setTimeout(() => setGone(true), (at + last.length * LINE_PACE + HOLD_S) * 1000);
    return () => [...ids, link, hide].forEach(clearTimeout);
  }, [sig, linkDelay]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새 줄이 위, 영화 자막처럼 두 줄까지 — 세 줄째부터는 자막 띠를 넘쳤다(10/1)
  const lines = timeline.slice(0, count).map(([l]) => l).reverse().slice(0, 2);

  return (
    <div
      className="flex flex-col items-center font-subtitle text-[clamp(15px,calc(.9vw+6px),30px)] tracking-wide text-[#e2cd5a]"
      style={{ textShadow: `${OUTLINE},0 0 4px rgba(0,0,0,.6)` }}
    >
      {/* 자글자글 — 옛 필름 자막처럼 글자·테두리가 아주 살짝 끓는다(잘게 낀 노이즈로 2~3px 비틀고, 노이즈 씨앗을 1초에 12번 바꾼다 — 10/2 사용자: 더 작은 입자로).
          움직임 줄이기를 켠 사람에겐 끈다 */}
      <svg aria-hidden className="absolute size-0">
        <filter id={boil}>
          <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="2" seed="1">
            <animate attributeName="seed" values="1;2;3;4;5;6;7;8;9;10;11;12" dur="1s" repeatCount="indefinite" calcMode="discrete" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="2.6" />
        </filter>
      </svg>
      <div className="flex flex-col items-center motion-reduce:![filter:none]" style={{ filter: `url(#${boil})` }}>
        {lines.map((l) => (
          // 높이가 0 에서 펼쳐지며 들어와, 아래 줄들이 부드럽게 밀려난다
          <div key={l} className="overflow-hidden animate-[subline_.45s_ease-out_both]">
            <p className={`mb-1 px-3 leading-tight transition-opacity duration-700 ${gone ? "opacity-0" : ""}`}>- {l}</p>
          </div>
        ))}
      </div>
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
