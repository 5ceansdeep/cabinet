"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveShelf, suggestTag, TAG_MAX } from "@/components/archive/shelf";
import { RESULT_DIALOGUE, RESULT_LINES, type Line } from "@/components/landing/lines";
import Subtitle, { LINE_PACE, subtitleDelays, subtitleLines } from "@/components/landing/Subtitle";
import { thud } from "@/lib/thud";
import { speak } from "@/lib/voice";
import CabinetWall from "./CabinetWall";
import Playlist from "./Playlist";
import CardReveal from "@/components/share/CardReveal";
import { findTracks, logThrow, type Track } from "./tracks";
import { apiUrl } from "@/lib/api";
import { KeyReturn } from "@phosphor-icons/react";

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

// 자막 아래 버튼 — 일반 UI 버튼(.btn), 3D 위에 뜨니 바탕을 깐다
const choice = "btn pointer-events-auto bg-background/85";
// 위 글자 버튼(서랍에 넣기·MY CABINET·NEW REQUEST) — 터치는 손가락이 닿게 위아래를 넓힌다
const action = "pointer-events-auto pointer-coarse:-my-2 pointer-coarse:py-2";
const SWIPE_PX = 40; // 이만큼 옆으로 밀면 한 칸 넘긴다(폰)

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
  const [keepHint, setKeepHint] = useState(false); // 듣기 시작하고 3초 뒤 "서랍에 넣기" 말풍선
  const keepHintShown = useRef(false); // 한 번만

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

  // 노래를 듣기 시작하면 3초 뒤 "서랍에 넣기" 말풍선(한 번만, 10/4 사용자)
  useEffect(() => {
    if (!playing || keepHintShown.current) return;
    const t = setTimeout(() => {
      keepHintShown.current = true;
      setKeepHint(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [playing]);

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

  // 마우스 휠로도 넘긴다 — 10/2 테스터: PC 에서 키보드로만 넘기니 애매했다. 한 번 굴릴 때 한 칸(0.25초에 한 번까지)
  useEffect(() => {
    if (phase !== "discs") return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const now = performance.now();
      if (Math.abs(d) < 4 || now - last < 250) return;
      last = now;
      move(d > 0 ? 1 : -1);
    };
    addEventListener("wheel", onWheel, { passive: true });
    return () => removeEventListener("wheel", onWheel);
  }, [phase, move]);

  /* 폰은 휠도 화살표도 없다 — 3D 위를 옆으로 밀어 넘긴다. 위로 던지기(디스크 버리기)와 안 겹치게 가로가 뚜렷할 때만.
     마우스로 끄는 건 디스크 돌리기라 손가락·펜만 듣는다 */
  useEffect(() => {
    if (phase !== "discs") return;
    let from: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      from = e.pointerType !== "mouse" && (e.target as HTMLElement).tagName === "CANVAS" ? { x: e.clientX, y: e.clientY } : null;
    };
    const up = (e: PointerEvent) => {
      if (!from) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      from = null;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > 1.5 * Math.abs(dy)) move(dx < 0 ? 1 : -1);
    };
    const cancel = () => (from = null);
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", cancel);
    return () => {
      removeEventListener("pointerdown", down);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", cancel);
    };
  }, [phase, move]);

  /* 서랍에 넣기 — 디스크가 아래 서랍으로 빨려 들고, 다 삼키면 "탁" 닫히며 네임택을 내민다 */
  function store() {
    setKeepHint(false);
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
      else later(() => void saveShelf(name, query, kept, interpretation).then(setSaved), 900); // 저장되면 공유 카드가 인쇄돼 올라온다
    };
    later(() => type(1), 90);
  }

  function discard(track: Track) {
    setThrown((ts) => [...ts, track.id]);
    logThrow(track.id, query);
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

          {/* 세로 화면(폰)은 옆으로 나란히 둘 폭이 없다 — 버튼 줄을 위에, 편지·해석을 그 아래에 */}
          <header className="pointer-events-none relative flex items-start justify-between gap-4 px-6 pt-6 font-mono text-xs tracking-[.15em] text-foreground/65 portrait:flex-col-reverse portrait:gap-2 portrait:px-4 portrait:pt-[max(.75rem,env(safe-area-inset-top))]">
            <div className="max-w-xl space-y-1 portrait:max-w-full">
              <p className="portrait:line-clamp-2">
                QUERY <span className="ml-2 normal-case tracking-normal text-foreground/85">{query || "(empty)"}</span>
              </p>
              {interpretation.length > 0 && (
                <p>
                  요청 해석 <span className="ml-2 normal-case tracking-normal text-accent/85">{interpretation.slice(0, 5).join(" · ")}</span>
                </p>
              )}
              {(missingArtist || (kinFor && kinArtists.length > 0)) && (
                <p className="normal-case tracking-normal text-subtitle">
                  {missingArtist ? RESULT_DIALOGUE.MISSING_ARTIST(missingArtist, kinArtists) : RESULT_DIALOGUE.FEW_ARTIST(kinFor!, kinArtists)}
                </p>
              )}
              {missingSong && <p className="normal-case tracking-normal text-subtitle">{RESULT_DIALOGUE.MISSING_SONG(missingSong)}</p>}
              {/* 조작 안내 — 세로 화면은 아래가 드라이브·자막 자리라 여기에 */}
              {phase === "discs" && kept.length > 0 && <p className="hidden text-foreground/60 portrait:block">{RESULT_DIALOGUE.HINT_TOUCH}</p>}
            </div>
            <span className="flex shrink-0 gap-4 portrait:w-full portrait:flex-row-reverse portrait:justify-between">
              {phase === "discs" && kept.length > 0 && (
                <span className="relative">
                  <button type="button" onClick={store} className={`${action} text-accent/85 hover:text-accent`}>
                    서랍에 넣기
                  </button>
                  {keepHint && (
                    <span
                      role="status"
                      className="pointer-events-none absolute top-full right-0 z-10 mt-3 w-max max-w-[14em] origin-top-right rounded-ui bg-foreground px-3.5 py-2 text-sm leading-snug font-sans tracking-normal text-background normal-case shadow-[0_8px_24px_rgba(0,0,0,.45)] animate-[bubble_.4s_cubic-bezier(.2,.8,.2,1)_both] before:absolute before:-top-[5px] before:right-5 before:border-x-[6px] before:border-b-[6px] before:border-x-transparent before:border-b-foreground"
                    >
                      {RESULT_DIALOGUE.KEEP_HINT}
                    </span>
                  )}
                </span>
              )}
              <Link href="/archive" className={`${action} text-accent/85 hover:text-accent`}>MY CABINET</Link>
              <Link href="/search" className={`${action} text-accent/85 hover:text-accent`}>NEW REQUEST</Link>
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
                <div className="mt-4 flex justify-center animate-[appear_.3s_1.5s_both]">
                  <button type="button" className={choice} onClick={() => dig({ thrown })}>
                    {RESULT_DIALOGUE.FAILED_ACTION}
                  </button>
                </div>
              )}
              {!dry && !failed && (
                <div className="mt-4 flex flex-wrap justify-center gap-3 animate-[appear_.3s_1.5s_both]">
                  <button type="button" className={choice} onClick={() => dig({ thrown })}>
                    {RESULT_DIALOGUE.RETRY}
                  </button>
                  <button type="button" className={choice} onClick={() => dig({ seen })}>
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
            /* 네임택 — 자동으로 지어 준 이름이 적혀 있고, 그 위에서 바로 고쳐 쓸 수 있다.
               10/2 테스터: 화면 아래 작게 붙어 있어 안 보였다 — 가운데에 크게, 버튼도 눈에 띄게 */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                print();
              }}
              className="pointer-events-auto absolute top-[44%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-ui border border-white/20 bg-neutral-200/95 px-8 py-6 shadow-[0_12px_40px_rgba(0,0,0,.6)] animate-[appear_.3s_both] [--background:#e5e5e5] [--ui:var(--ink-light)]"
            >
              <p className="font-mono text-xs tracking-[.15em] text-neutral-600">{RESULT_DIALOGUE.NAME_HINT}</p>
              <input
                autoFocus
                value={tag}
                onChange={(e) => setTag(e.target.value.slice(0, TAG_MAX))}
                aria-label="서랍 이름"
                className="w-64 border-b-2 border-neutral-400 bg-transparent pb-1 text-center font-mono text-xl tracking-[.15em] text-neutral-800 outline-none focus:border-neutral-800 portrait:w-[72cqw] portrait:text-lg portrait:tracking-normal" // 폰은 폭이 좁아 긴 이름이 잘렸다
              />
              <button type="submit" className="btn-solid">
                {RESULT_DIALOGUE.NAME_ACTION}
                <KeyReturn aria-hidden size={14} weight="bold" />
              </button>
            </form>
          )}

          {/* 아래 가운데는 드라이브 자리 — 안내는 왼쪽 아래로 */}
          <footer className="pointer-events-none absolute bottom-[3cqh] left-6 font-mono text-xs tracking-[.15em] text-foreground/60 portrait:hidden">
            {RESULT_DIALOGUE.HINT}
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
