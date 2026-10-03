"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { reducedMotion } from "@/lib/motion";

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
  const noise = useRef<SVGFETurbulenceElement>(null);
  const warp = useRef<SVGFEDisplacementMapElement>(null);
  const grain = useRef<SVGFETurbulenceElement>(null);

  /* 자글자글을 불규칙하게 — 10/4 사용자: 정해진 주기(1.3·2.3초)로 되풀이돼 규칙적으로 꿀렁였다.
     다음에 바뀔 때까지의 간격·씨앗·세기를 매번 새로 뽑는다. 대개 짧게 자글대다가 가끔 멈칫하고, 가끔 세게 튄다 */
  useEffect(() => {
    if (reducedMotion()) return;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      noise.current?.setAttribute("seed", String(1 + Math.floor(Math.random() * 999)));
      const spike = Math.random() < 0.12;
      warp.current?.setAttribute("scale", (spike ? 3 + Math.random() * 0.6 : 1.8 + Math.random() * 0.8).toFixed(2));
      const pause = Math.random() < 0.15;
      id = setTimeout(tick, pause ? 600 + Math.random() * 800 : 60 + Math.random() ** 2 * 500);
    };
    tick();
    return () => clearTimeout(id);
  }, []);

  /* 입자는 따로 — 가장자리와 같은 박자면 대부분 짧은 간격이라 일정하게 깜빡이는 것처럼 보였다(10/4 사용자).
     몇 번(2~7) 빠르게 몰아서 바뀌다가 0.3~2초 멈춘다. 몰아치는 길이·멈춤 길이가 매번 달라 박자가 안 잡힌다 */
  useEffect(() => {
    if (reducedMotion()) return;
    let id: ReturnType<typeof setTimeout>;
    let left = 0;
    const tick = () => {
      grain.current?.setAttribute("seed", String(1 + Math.floor(Math.random() * 999)));
      if (left-- > 0) id = setTimeout(tick, 40 + Math.random() * 90);
      else {
        left = 1 + Math.floor(Math.random() * 6);
        id = setTimeout(tick, 300 + Math.random() ** 1.5 * 1700);
      }
    };
    tick();
    return () => clearTimeout(id);
  }, []);

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
    <div className="flex flex-col items-center font-subtitle text-[clamp(18px,calc(1.1vw+10px),40px)] tracking-wide text-subtitle">
      {/* 자글자글 — 옛 필름 자막처럼 글자·테두리가 아주 살짝 끓는다(잘게 낀 노이즈로 2~3px 비튼다).
          10/2 사용자: 더 작은 입자로(노이즈 0.22). 씨앗·세기는 위 useEffect 가 불규칙하게 바꾼다(10/4). 가장자리만 끓는다(10/2 사용자) — 글자를 1px 깎은 속은 원래 그대로, 그 바깥만 비튼 그림으로.
          움직임 줄이기를 켠 사람에겐 끈다 */}
      <svg aria-hidden className="absolute size-0">
        <filter id={boil}>
          <feTurbulence ref={noise} type="fractalNoise" baseFrequency="0.22" numOctaves="2" seed="1" result="noise" />
          <feDisplacementMap ref={warp} in="SourceGraphic" in2="noise" scale="2.2" result="boiled" />
          <feMorphology in="SourceAlpha" operator="erode" radius="1" result="core" />
          <feComposite in="SourceGraphic" in2="core" operator="in" result="inner" />
          <feComposite in="boiled" in2="core" operator="out" result="rim" />
          {/* 필름 입자 — 글자 안에 잘게 박힌 검은 점(10/4 사용자: 노이즈, 거의 안 보여 촘촘히). 몰아서 자글대다 멈추는 불규칙한 박자로 바뀐다(위 useEffect). 노이즈 밝은 쪽 절반쯤을 점으로, 글자 모양 안에만 */}
          <feTurbulence ref={grain} type="fractalNoise" baseFrequency="0.65" numOctaves="1" seed="2" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 -1.8" result="specks" />
          <feComposite in="specks" in2="core" operator="in" result="grained" />
          <feMerge>
            <feMergeNode in="rim" />
            <feMergeNode in="inner" />
            <feMergeNode in="grained" />
          </feMerge>
        </filter>
      </svg>
      {/* 색 번짐 — 유리를 지난 빛처럼 주황·노랑은 왼쪽, 파랑·시안은 오른쪽으로 흐릿하게 갈라진다(10/4 사용자 레퍼런스: Ion Lucin 'Forget me not', 가로 유리선은 빼고).
          가까운 번짐(살짝 흐림) + 먼 번짐(많이 흐림) 두 겹. em 이라 글자 크기를 따라간다. 깜빡이지 않게 고정 */}
      <div
        className="flex flex-col items-center motion-reduce:![filter:none]"
        style={{ filter: `url(#${boil})`, textShadow: `${OUTLINE},0 0 4px rgba(0,0,0,.6),-.08em 0 .05em rgba(255,150,0,.9),.08em 0 .05em rgba(30,140,255,.9),-.2em .03em .3em rgba(255,190,40,.7),.2em -.03em .3em rgba(0,170,255,.7)` }}
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
