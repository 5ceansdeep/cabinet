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
import Playlist from "./Playlist";
import CardReveal from "@/components/share/CardReveal";
import { findTracks, logThrow, type Track } from "./tracks";
import { apiUrl } from "@/lib/api";

const SEARCH_MS = 1200; // 서랍을 뒤지는 최소 시간 — 곡 찾기는 그동안 같이 한다(보통 이보다 오래 걸린다)
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
  /* riffle 서랍 뒤지기 → discs 고르기 → saving 서랍이 삼킴 → naming 네임택에 이름 적기 → printing 타자기로 인쇄 */
  const [phase, setPhase] = useState<"riffle" | "discs" | "saving" | "naming" | "printing">("riffle");
  const router = useRouter();
  const [tag, setTag] = useState("");
  const [printed, setPrinted] = useState(0); // 네임택에 찍힌 글자 수
  const [interpretation, setInterpretation] = useState<string[]>([]); // 요청 해석 — 요청문을 어떤 표식으로 읽었나
  const [missingArtist, setMissingArtist] = useState<string | null>(null); // 편지에 쓴 가수 곡이 서류함에 없다
  const [kinArtists, setKinArtists] = useState<string[]>([]); // 그래서 대신 채운 비슷한 가수(곡이 적을 때도)
  const [kinFor, setKinFor] = useState<string | null>(null); // 곡이 적은 그 가수
  const [missingSong, setMissingSong] = useState<string | null>(null); // 편지에 꼽은 곡이 서류함에 없다
  const [greeting, setGreeting] = useState<Line | null>(null); // 곡을 건네며 하는 신의 한마디 — 뒤질 때마다 새로
  const [kept, setKept] = useState<Track[]>([]); // 위로 던져 뺀 곡은 여기서 빠진다
  const [seen, setSeen] = useState<string[]>([]); // 지금까지 보여 준 곡
  const [thrown, setThrown] = useState<string[]>([]); // 던져 버린 곡
  const [dry, setDry] = useState(false); // 이 편지로는 더 꺼낼 곡이 없다
  const [failed, setFailed] = useState(false); // 서버가 오류를 냈다 — 다시 뒤지기만
  const [playing, setPlaying] = useState<Track | null>(null); // 드라이브에 꽂힌 디스크
  const [index, setIndex] = useState(0); // 가운데 앞에 나온 곡 (늘어선 줄 기준)
  const [reveal, setReveal] = useState(0); // 곡이 올 때마다 하나씩 — 정면 서랍이 쭉 빠진다
  const [saved, setSaved] = useState<{ id: string; remote: boolean } | null>(null); // 서랍에 넣었다 — 공유 카드

  /* 서랍에 넣는 동안 걸어 둔 타이머들 — 도중에 다른 화면으로 가면 전부 끈다.
     안 끄면 떠난 뒤에도 이름이 마저 찍히고, 서랍이 저장되고, 보관함으로 끌려간다 */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach((id) => clearTimeout(id)), []);
  const later = (fn: () => void, ms: number) => void timers.current.push(setTimeout(fn, ms));

  /* 서랍을 뒤진다 — 벽 서랍들이 탁탁 빠지는 동안 곡을 찾고, 둘 다 끝나면 정면 서랍에서 디스크가 나온다 */
  const digs = useRef(0); // 가장 최근 뒤지기만 반영한다 — 개발 모드의 이중 실행·연타에 늦게 온 결과가 덮어쓰지 않게
  const dig = useCallback(
    async (opt: { seen?: string[]; thrown?: string[] } = {}) => {
      const run = ++digs.current;
      setPhase("riffle");
      setPlaying(null);
      const [found] = await Promise.all([findTracks(query, opt), wait(SEARCH_MS)]);
      if (run !== digs.current) return;
      thud(70);
      setInterpretation(found.interpretation);
      setMissingArtist(found.missingArtist ?? null);
      setKinArtists(found.kinArtists ?? []);
      setKinFor(found.kinFor ?? null);
      setMissingSong(found.missingSong ?? null);
      // 신의 한마디·곡별 이유는 재정렬과 같은 호출로 곡 목록과 함께 온다(10/1 — 재정렬 순서를 쓰면서).
      // 영어 음성은 백엔드가 ElevenLabs 로 만든 mp3(켜 뒀을 때만) — 꺼져 있으면 자막만
      setGreeting(found.line ? { text: found.line.ko, voiceKey: found.line.voice ? apiUrl(`/voice/${found.line.voice}`) : undefined } : null);
      setKept(found.tracks);
      setSeen((s) => [...s, ...found.tracks.map((t) => t.id)]);
      setFailed(!!found.failed);
      setDry(!found.failed && found.tracks.length === 0);
      setIndex(Math.floor(found.tracks.length / 2));
      setPhase("discs");
      if (!found.tracks.length) return;
      setReveal((r) => r + 1);
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
      else later(() => void saveShelf(name, query, kept).then(setSaved), 900); // 저장되면 공유 카드가 인쇄돼 올라온다
    };
    later(() => type(1), 90);
  }

  function discard(track: Track) {
    setThrown((ts) => [...ts, track.id]);
    logThrow(track.id);
    setKept((ts) => ts.filter((t) => t.id !== track.id));
    setIndex((i) => Math.max(0, Math.min(row.length - 2, i)));
  }

  const empty = phase === "discs" && kept.length === 0;
  const said = useSaying(
    empty ? (failed ? RESULT_LINES.failed : dry ? RESULT_LINES.dry : RESULT_LINES.empty) : phase === "discs" ? greeting : null,
  );
  const greeted = said && said.line === greeting ? said : null;
  // 자막 띠 — 서버 렌더에는 document 가 없으니 브라우저에서만 찾는다
  const subtitleBar = useSyncExternalStore(noop, () => document.getElementById("cinema-sub"), () => null);

  return (
    <main data-theme="void" className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-background text-foreground">
      <>
          {/* 처음부터 3D 방 — 곡을 찾는 동안 벽 서랍들이 탁탁 뒤져지고, 오면 정면 서랍에서 디스크가 솟아오른다(10/1, 검은 카드 넘김 대신) */}
          <CabinetWall
            tracks={phase === "riffle" ? [] : row}
            index={index}
            playing={playing}
            saving={phase !== "discs" && phase !== "riffle"}
            searching={phase === "riffle"}
            reveal={reveal}
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
              {(missingArtist || (kinFor && kinArtists.length > 0)) && (
                <p className="normal-case tracking-normal text-[#e2cd5a]/90">
                  {missingArtist ? RESULT_DIALOGUE.MISSING_ARTIST(missingArtist, kinArtists) : RESULT_DIALOGUE.FEW_ARTIST(kinFor!, kinArtists)}
                </p>
              )}
              {missingSong && <p className="normal-case tracking-normal text-[#e2cd5a]/90">{RESULT_DIALOGUE.MISSING_SONG(missingSong)}</p>}
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
              {failed && (
                <div className="mt-4 flex justify-center" style={{ animationDelay: "1.5s" }}>
                  <button className={choice} onClick={() => dig({ thrown })}>
                    {RESULT_DIALOGUE.FAILED_ACTION}
                  </button>
                </div>
              )}
              {!dry && !failed && (
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

          {/* 오른쪽 곡 목록 + 재생 — 누르면 그 곡이 드라이브로. 디스크 밑 이름표는 10/1 뺐다(곡 이름·이유는 목록에).
              보고서 꺼 둠 — 되살릴 때 app/report/[id]/page.tsx 와 같이 목록에 "보고서 열람" 링크를 단다 */}
          {phase === "discs" && kept.length > 0 && <Playlist query={query} tracks={kept} playing={playing} onPick={insert} onEject={eject} />}

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

          {/* 아래 가운데는 드라이브 자리 — 안내는 왼쪽 아래로 */}
          <footer className="pointer-events-none absolute bottom-[3cqh] left-6 font-mono text-[10px] tracking-[.2em] text-foreground/40">
            CLICK TO PLAY · DRAG TO ROTATE · FLICK UP TO DISCARD
          </footer>
        </>
      {saved && (
        <CardReveal
          data={{ q: query, keywords: interpretation, line: greeting?.text ?? null, tracks: kept }}
          shelfId={saved.id}
          remote={saved.remote}
          onDone={() => router.push(`/archive?new=${saved.id}`)}
        />
      )}
    </main>
  );
}
