"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveShelf, suggestTag } from "@/components/archive/shelf";
import { RESULT_DIALOGUE, RESULT_LINES, type Line } from "@/components/landing/lines";
import Subtitle, { LINE_PACE, subtitleDelays, subtitleLines } from "@/components/landing/Subtitle";
import { thud } from "@/lib/thud";
import { speak } from "@/lib/voice";
import CabinetWall from "./CabinetWall";
import PlayerBar from "./PlayerBar";
import Riffle from "./Riffle";
import { findTracks, type Track } from "./tracks";

const RIFFLE_MS = 1600; // 카드가 촤르르 넘어가는 시간 — 곡 찾기는 그동안 같이 한다
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const noop = () => () => {};

/* 신의 한마디 — 목소리가 시작될 때 자막 줄을 띄운다 */
function useSaying(line: Line | null) {
  const [said, setSaid] = useState<{ line: Line; timeline: [string, number][] } | null>(null);
  useEffect(() => {
    if (!line) return;
    speak(line.text, line.voiceKey, subtitleLines(line.text).length, (delays) =>
      setSaid({ line, timeline: subtitleDelays(line.text, delays ?? undefined) }),
    );
  }, [line]);
  return line && said?.line === line ? said : null;
}

// 자막 아래 버튼 — Subtitle 의 링크 버튼과 같은 모양
const choice =
  "pointer-events-auto inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-5 py-2 font-letter text-sm text-neutral-800 shadow-[0_4px_16px_rgba(0,0,0,.12)] backdrop-blur-sm transition animate-[appear_.5s_both] hover:-translate-y-0.5 hover:bg-white";

/* 4·4-1번 페이지 — 서랍 속에서 건져 올린 플로피 디스크들. 디스크도 서류함도 전부 3D 이고,
   그 위에 얹힌 DOM 은 제목·재생바 같은 글자뿐이다 */
export default function Results({ query }: { query: string }) {
  /* riffle 카드 넘김 → discs 고르기 → saving 서랍이 삼킴 → naming 네임택에 이름 적기 → printing 타자기로 인쇄 */
  const [phase, setPhase] = useState<"riffle" | "discs" | "saving" | "naming" | "printing">("riffle");
  const router = useRouter();
  const [tag, setTag] = useState("");
  const [printed, setPrinted] = useState(0); // 네임택에 찍힌 글자 수
  const [interpretation, setInterpretation] = useState<string[]>([]); // 요청 해석 — 요청문을 어떤 표식으로 읽었나
  const [greeting, setGreeting] = useState<Line | null>(null); // 곡을 건네며 하는 신의 한마디 — 뒤질 때마다 새로
  const [kept, setKept] = useState<Track[]>([]); // 위로 던져 뺀 곡은 여기서 빠진다
  const [seen, setSeen] = useState<string[]>([]); // 지금까지 보여 준 곡
  const [thrown, setThrown] = useState<string[]>([]); // 던져 버린 곡
  const [dry, setDry] = useState(false); // 이 편지로는 더 꺼낼 곡이 없다
  const [playing, setPlaying] = useState<Track | null>(null); // 드라이브에 꽂힌 디스크
  const [index, setIndex] = useState(0); // 가운데 앞에 나온 곡 (늘어선 줄 기준)

  /* 서랍에 넣는 동안 걸어 둔 타이머들 — 도중에 다른 화면으로 가면 전부 끈다.
     안 끄면 떠난 뒤에도 이름이 마저 찍히고, 서랍이 저장되고, 보관함으로 끌려간다 */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach((id) => clearTimeout(id)), []);
  const later = (fn: () => void, ms: number) => void timers.current.push(setTimeout(fn, ms));

  /* 서랍을 뒤진다 — 카드가 촤르르 넘어가는 동안 곡을 찾고, 둘 다 끝나면 딱 멈추며 디스크가 나온다 */
  const digs = useRef(0); // 가장 최근 뒤지기만 반영한다 — 개발 모드의 이중 실행·연타에 늦게 온 결과가 덮어쓰지 않게
  const dig = useCallback(
    async (opt: { seen?: string[]; thrown?: string[] } = {}) => {
      const run = ++digs.current;
      setPhase("riffle");
      setPlaying(null);
      const [found] = await Promise.all([findTracks(query, opt), wait(RIFFLE_MS)]);
      if (run !== digs.current) return;
      thud(70);
      setInterpretation(found.interpretation);
      // ponytail: 음성은 기계 음성이 한국어 자막을 읽는다 — ElevenLabs 를 붙이면 found.line.en 을 백엔드에서 음성으로
      setGreeting(found.line && found.tracks.length ? { text: found.line.ko } : null);
      setKept(found.tracks);
      setSeen((s) => [...s, ...found.tracks.map((t) => t.id)]);
      setDry(found.tracks.length === 0);
      setIndex(Math.floor(found.tracks.length / 2));
      setPhase("discs");
    },
    [query],
  );

  useEffect(() => {
    dig(); // eslint-disable-line react-hooks/set-state-in-effect -- 처음 한 번 서랍을 뒤진다
  }, [dig]);

  const row = kept.filter((t) => t !== playing); // 꽂힌 디스크는 줄에서 빠진다
  const move = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(row.length - 1, i + d))), [row.length]);

  function insert(track: Track) {
    thud(160); // 드라이브에 "탁"
    setPlaying(track);
    setIndex((i) => Math.max(0, Math.min(row.length - 2, i)));
  }
  const eject = () => {
    thud(90);
    setPlaying(null);
  };

  // 좌우 화살표로 넘기고, 아래 화살표로 가운데 디스크를 꽂고, 위 화살표로 뺀다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "discs" || (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowDown" && row[index]) insert(row[index]);
      if (e.key === "ArrowUp" && playing) eject();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  /* 서랍에 넣기 — 디스크가 아래 서랍으로 빨려 들고, 다 삼키면 "탁" 닫히며 네임택을 내민다 */
  function store() {
    setPhase("saving");
    setPlaying(null);
    setTag(suggestTag(query));
    thud(120);
    later(() => {
      thud(70);
      setPhase("naming");
    }, 1400);
  }

  /* 이름을 정했다 — 네임택에 한 글자씩 찍고(그동안 저장), 보관함으로 */
  function print() {
    const name = tag.trim() || suggestTag(query);
    setTag(name);
    setPhase("printing");
    // 한 글자씩 — 90ms 간격으로 다음 글자를 예약한다(모두 timers 에 걸려 떠나면 같이 꺼진다).
    // 저장은 다 찍은 뒤에 — 도중에 떠나면 저장하지 않는다
    const type = (n: number) => {
      setPrinted(n);
      thud(420 + (n % 3) * 40); // 타자기 소리
      if (n < name.length) later(() => type(n + 1), 90);
      else later(() => void saveShelf(name, query, kept).then((shelf) => router.push(`/archive?new=${shelf}`)), 900);
    };
    later(() => type(1), 90);
  }

  function discard(track: Track) {
    setThrown((ts) => [...ts, track.id]);
    setKept((ts) => ts.filter((t) => t.id !== track.id));
    setIndex((i) => Math.max(0, Math.min(row.length - 2, i)));
  }

  const empty = phase === "discs" && kept.length === 0;
  const said = useSaying(empty ? (dry ? RESULT_LINES.dry : RESULT_LINES.empty) : phase === "discs" ? greeting : null);
  const greeted = said && said.line === greeting ? said : null;
  // 자막 띠 — 서버 렌더에는 document 가 없으니 브라우저에서만 찾는다
  const subtitleBar = useSyncExternalStore(noop, () => document.getElementById("cinema-sub"), () => null);
  const center = row[index];

  return (
    <main data-theme="void" className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-background text-foreground">
      {phase === "riffle" ? (
        <Riffle />
      ) : (
        <>
          <CabinetWall
            tracks={row}
            index={index}
            playing={playing}
            saving={phase !== "discs"}
            tag={phase === "printing" ? tag.slice(0, printed) : ""}
            onInsert={insert}
            onEject={eject}
            onDiscard={discard}
          />

          <header className="pointer-events-none relative flex items-start justify-between gap-4 px-6 pt-6 font-mono text-[10px] tracking-[.2em] text-foreground/50">
            <div className="max-w-xl space-y-1">
              <p>
                QUERY — <span className="normal-case tracking-normal text-foreground/80">{query || "(empty)"}</span>
              </p>
              {interpretation.length > 0 && (
                <p>
                  요청 해석 — <span className="normal-case tracking-normal text-accent/80">{interpretation.slice(0, 5).join(" · ")}</span>
                </p>
              )}
            </div>
            <span className="flex shrink-0 gap-4">
              {phase === "discs" && kept.length > 0 && (
                <button onClick={store} className="pointer-events-auto text-accent/80 hover:text-accent">
                  서랍에 넣기
                </button>
              )}
              <Link href="/archive" className="pointer-events-auto text-accent/80 hover:text-accent">MY CABINET</Link>
              <Link href="/search" className="pointer-events-auto text-accent/80 hover:text-accent">NEW REQUEST</Link>
            </span>
          </header>

          <div className="flex-1" />

          {/* 곡을 건네며 — 신의 한마디는 영화처럼 프레임 아래 검은 띠(layout 의 #cinema-sub)에 */}
          {greeted &&
            subtitleBar &&
            createPortal(
              <div key={greeted.line.text} aria-live="polite" className="text-center">
                <Subtitle timeline={greeted.timeline} linkDelay={0} />
              </div>,
              subtitleBar,
            )}

          {/* 전부 던져 버렸다 — 신의 한마디와 두 갈래 */}
          {empty && said && (
            <div className="pointer-events-none absolute inset-x-0 top-[38%] flex flex-col items-center px-4">
              <Subtitle
                key={said.line.text}
                timeline={said.timeline}
                link={said.line.link}
                linkDelay={said.timeline.at(-1)![1] + said.timeline.at(-1)![0].length * LINE_PACE}
              />
              {!dry && (
                <div className="mt-4 flex flex-wrap justify-center gap-3" style={{ animationDelay: "1.5s" }}>
                  <button className={choice} onClick={() => dig({ thrown })}>
                    {RESULT_DIALOGUE.RETRY}
                  </button>
                  <button className={choice} onClick={() => dig({ seen })}>
                    {RESULT_DIALOGUE.MORE}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 가운데 디스크의 이름표 — 3D 디스크와 드라이브 사이, 양옆에 넘기는 화살표 */}
          {center && phase === "discs" && !playing && (
            <div className="pointer-events-none absolute inset-x-0 top-[62%] flex items-start justify-center gap-6 text-center">
              {[-1, 1].map((dir) => (
                <button
                  key={dir}
                  aria-label={dir < 0 ? "이전 디스크" : "다음 디스크"}
                  onClick={() => move(dir)}
                  disabled={dir < 0 ? index === 0 : index === row.length - 1}
                  className={`pointer-events-auto px-3 py-2 font-mono text-accent/60 hover:text-accent disabled:opacity-20 ${dir < 0 ? "order-first" : "order-last"}`}
                >
                  {dir < 0 ? "◀" : "▶"}
                </button>
              ))}
              <div className="w-72">
                <p className="truncate text-sm">{center.title}</p>
                <p className="truncate text-xs text-foreground/50">{center.artist}</p>
                {/* 왜 이 곡인지 — 밝은 서랍 벽 위라 그림자로 띄운다 */}
                {center.reason && (
                  <p className="mt-1.5 text-xs leading-5 text-white [text-shadow:0_0_4px_rgba(0,0,0,.95),0_0_10px_rgba(0,0,0,.8)]">{center.reason}</p>
                )}
                {/* 보고서 꺼 둠 — 되살릴 때 app/report/[id]/page.tsx 와 같이
                <Link
                  href={`/report/${center.id}?q=${encodeURIComponent(query)}`}
                  className="pointer-events-auto mt-1 inline-block font-mono text-[10px] tracking-[.2em] text-accent/70 hover:text-accent"
                >
                  보고서 열람
                </Link> */}
              </div>
            </div>
          )}

          {phase === "naming" && (
            /* 네임택 — 자동으로 지어 준 이름이 적혀 있고, 그 위에서 바로 고쳐 쓸 수 있다 */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                print();
              }}
              className="relative mx-auto mb-4 flex w-fit items-center gap-3 rounded-sm border border-white/20 bg-neutral-200/90 px-4 py-2 shadow-[0_8px_30px_rgba(0,0,0,.5)]"
            >
              <input
                autoFocus
                value={tag}
                onChange={(e) => setTag(e.target.value.slice(0, 16))}
                aria-label="서랍 이름"
                className="w-44 bg-transparent text-center font-mono text-sm tracking-[.2em] text-neutral-800 outline-none"
              />
              <button type="submit" className="font-mono text-[10px] tracking-[.2em] text-neutral-600 hover:text-neutral-900">
                붙이기 ⏎
              </button>
            </form>
          )}

          <PlayerBar track={phase === "discs" ? playing : null} onEject={eject} />

          <footer className="relative px-6 pb-6 text-center font-mono text-[10px] tracking-[.2em] text-foreground/40">
            CLICK TO PLAY · DRAG TO ROTATE · FLICK UP TO DISCARD
          </footer>
        </>
      )}
    </main>
  );
}
