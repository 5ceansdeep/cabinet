"use client";

import { useEffect, useId, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
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
    <div className="flex flex-col items-center font-subtitle text-[clamp(15px,calc(.9vw+6px),30px)] tracking-wide text-subtitle">
      {/* 자글자글 — 옛 필름 자막처럼 글자·테두리가 아주 살짝 끓는다(잘게 낀 노이즈로 2~3px 비튼다).
          10/2 사용자: 더 작은 입자로, 불규칙하게 — 노이즈를 촘촘히(0.22), 씨앗은 들쭉날쭉한 간격으로(1.3초), 비트는 세기는 가끔 튀게(2.3초).
          두 주기가 안 맞물려 반복이 잘 안 보인다. 가장자리만 끓는다(10/2 사용자) — 글자를 1px 깎은 속은 원래 그대로, 그 바깥만 비튼 그림으로.
          움직임 줄이기를 켠 사람에겐 끈다 */}
      <svg aria-hidden className="absolute size-0">
        <filter id={boil}>
          <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="2" seed="1" result="noise">
            <animate attributeName="seed" values="1;7;3;12;5;9;2;11;4;8;6;10;13" keyTimes="0;.06;.1;.21;.27;.3;.42;.47;.58;.66;.71;.85;.93" dur="1.3s" repeatCount="indefinite" calcMode="discrete" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" result="boiled">
            <animate attributeName="scale" values="2.2;2.2;3.4;2;2.6;2.2;3.1;2.2" keyTimes="0;.2;.24;.4;.55;.7;.74;1" dur="2.3s" repeatCount="indefinite" calcMode="discrete" />
          </feDisplacementMap>
          <feMorphology in="SourceAlpha" operator="erode" radius="1" result="core" />
          <feComposite in="SourceGraphic" in2="core" operator="in" result="inner" />
          <feComposite in="boiled" in2="core" operator="out" result="rim" />
          {/* 필름 입자 — 글자 안에 잘게 깜빡이는 검은 점(10/4 사용자: 노이즈). 밝은 노이즈만 남겨 듬성듬성, 글자 모양 안에만 */}
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="2" result="grain">
            <animate attributeName="seed" values="2;9;4;14;6;11;3" dur="0.42s" repeatCount="indefinite" calcMode="discrete" />
          </feTurbulence>
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -1.35" result="specks" />
          <feComposite in="specks" in2="core" operator="in" result="grained" />
          <feMerge>
            <feMergeNode in="rim" />
            <feMergeNode in="inner" />
            <feMergeNode in="grained" />
          </feMerge>
        </filter>
      </svg>
      {/* 글리치 — 몇 초에 한 번 0.2초 남짓 빨강·시안으로 갈라지고 옆으로 튀며 한 줄이 찢어진다(10/4 사용자). 평소엔 그대로 읽힌다.
          갈라진 색은 --rgb(globals.css sub-glitch)로, 테두리 그림자 맨 아래에 깐다 */}
      <div
        className="flex flex-col items-center animate-[sub-glitch_3.7s_steps(1,end)_infinite] motion-reduce:![filter:none]"
        style={{ filter: `url(#${boil})`, textShadow: `${OUTLINE},0 0 4px rgba(0,0,0,.6),var(--rgb,0 0 transparent)` }}
      >
        {lines.map((l) => (
          // 위에서 살짝 내려오며 나타난다(높이는 애니메이션하지 않는다 — 디자인 규칙)
          <div key={l} className="animate-[subline_.3s_cubic-bezier(.16,1,.3,1)_both]">
            <p className={`mb-1 px-3 leading-tight transition-opacity duration-300 ${gone ? "opacity-0" : ""}`}>- {l}</p>
          </div>
        ))}
      </div>
      {link && linked && (
        // 자막 아래 버튼 — 일반 UI 버튼(.btn). 3D 장면 위에 뜨니 바탕을 깔아 대비를 지킨다
        <Link href={link.href} className="btn pointer-events-auto mt-4 bg-background/85 [text-shadow:none] animate-[appear_.3s_both]">
          {link.label}
          <ArrowRight aria-hidden size={14} weight="bold" />
        </Link>
      )}
    </div>
  );
}
