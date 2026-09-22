import { analyzeSpeech } from "./cues";

/* 대사 한 줄을 목소리로. key 가 있으면 public/voice/{key}.mp3 를 틀고, 파일이 없으면 브라우저 내장 음성합성으로 읽는다.
   대사는 끊지 않는다 — 앞 대사가 말하는 중이면 새 대사는 기다렸다가 이어서 나온다 (파일 끝의 공백은 기다리지 않음). 예외: cut() — 사용자가 엔터를 치면 바로 끊는다.
   기다리는 사이 또 새 대사가 오면 가장 최근 것만 남긴다. 페이지를 옮겨도 하던 대사는 끝까지 나온다.
   onStart — 그 대사의 소리가 실제로 시작될 때 불린다. 자막 줄(lines 개)마다 "지금부터 몇 초 뒤"를 주거나, 모르면 null.
   브라우저는 사용자가 한 번이라도 클릭·키 입력을 해야 소리를 낸다 (그 전엔 소리 없이 자막만). */

type Job = { text: string; key?: string; lines: number; onStart?: (delays: number[] | null) => void };

const TAIL = 0.25; // 말이 끝나고 다음 대사까지 숨 고르는 시간(초)
const MAX_LINE = 20; // 끝을 모르는 대사도 이 초가 지나면 끝난 것으로 — 대기열이 영영 멈추지 않게
const analyses = new Map<string, Promise<{ starts: number[]; end: number }>>(); // 파일·줄 수별 — 한 번만 분석
let busyUntil = 0; // 지금 대사가 말을 마치는 시각 (performance.now 기준 ms)
let pending: Job | null = null; // 기다리는 대사 — 새로 오면 덮어쓴다 (같은 대사가 여러 번 와도 한 번만)
let playing = ""; // 지금 말하는 대사
let timer: ReturnType<typeof setTimeout> | undefined;
let gen = 0; // 대사마다 번호 — 끊긴 대사의 늦은 콜백은 무시한다
let current: HTMLAudioElement | null = null;
let blocked: Job | null = null; // 브라우저가 소리를 막아 못 튼 대사 — 첫 클릭·키 입력 때 다시 튼다
const untilKnown = () => performance.now() + MAX_LINE * 1000; // 끝을 알 때까지 잠정

function analyze(src: string, count: number) {
  let p = analyses.get(src + count);
  if (!p) {
    p = fetch(src)
      .then((r) => r.arrayBuffer())
      .then((buf) => new OfflineAudioContext(1, 1, 44100).decodeAudioData(buf))
      .then((audio) => analyzeSpeech(audio.getChannelData(0), audio.sampleRate, count));
    analyses.set(src + count, p);
  }
  return p;
}

// 앞 대사가 끝나면 기다리던 대사를 튼다
function next() {
  clearTimeout(timer);
  const wait = busyUntil - performance.now();
  if (wait > 0) timer = setTimeout(next, wait);
  else if (pending) {
    const job = pending;
    pending = null;
    playing = job.text;
    gen++;
    play(job, gen);
  }
}

const doneAt = (id: number, sec: number) => {
  if (id !== gen) return;
  busyUntil = performance.now() + (sec + TAIL) * 1000;
  next();
};

// 파일이 없을 때 — 낮고 느린 기계 음성 (한국어 목소리가 있으면 그걸로)
function tts(job: Job, id: number) {
  if (id !== gen) return;
  job.onStart?.(null);
  if (typeof speechSynthesis === "undefined") return doneAt(id, 0);
  const u = new SpeechSynthesisUtterance(job.text);
  u.lang = "ko-KR";
  u.pitch = 0.3;
  u.rate = 0.8;
  const ko = speechSynthesis.getVoices().find((v) => v.lang.startsWith("ko"));
  if (ko) u.voice = ko;
  u.onend = u.onerror = () => doneAt(id, 0);
  busyUntil = untilKnown(); // 끝날 때까지
  speechSynthesis.speak(u);
}

function play(job: Job, id: number) {
  if (!job.key) return tts(job, id);
  const src = `/voice/${job.key}.mp3`;
  const a = new Audio(src);
  current = a;
  busyUntil = untilKnown(); // 말을 언제 마치는지 알 때까지
  a.onerror = () => tts(job, id); // 파일이 아직 없으면 기계 음성으로
  a.addEventListener(
    "playing",
    () =>
      analyze(src, job.lines)
        .then(({ starts, end }) => {
          if (id !== gen) return;
          job.onStart?.(starts.map((t) => t - a.currentTime)); // 분석하는 동안 흐른 재생 시간을 뺀다
          doneAt(id, end - a.currentTime);
        })
        .catch(() => {
          if (id !== gen) return;
          job.onStart?.(null);
          a.onended = () => doneAt(id, 0);
        }),
    { once: true },
  );
  a.play().catch((e: Error) => {
    if (e.name === "NotSupportedError" || id !== gen) return; // 파일 없음은 onerror 가 맡는다
    if (e.name === "NotAllowedError") {
      // 아직 소리를 못 낸다(새로 불러온 페이지 등) — 자막만 먼저, 첫 클릭·키 입력 때 이 대사를 다시 튼다
      blocked = job;
      addEventListener("pointerdown", unblock, { once: true });
      addEventListener("keydown", unblock, { once: true });
      job.onStart?.(null);
    }
    doneAt(id, 0);
  });
}

function unblock() {
  removeEventListener("pointerdown", unblock);
  removeEventListener("keydown", unblock);
  const job = blocked;
  blocked = null;
  // 그사이 다른 대사가 나오고 있지 않을 때만 — 늦게라도 들려준다
  if (job && !pending && performance.now() >= busyUntil) {
    playing = job.text;
    gen++;
    play(job, gen);
  }
}

export function speak(text: string, key?: string, lines = 1, onStart?: Job["onStart"]) {
  // 같은 대사가 지금 나오고 있으면 또 줄 세우지 않는다 (엔터 연타·개발 모드의 이중 실행에 되풀이되지 않게)
  if (text === playing && performance.now() < busyUntil) return;
  blocked = null; // 새 대사가 왔으면 막혔던 옛 대사는 버린다
  pending = { text, key, lines, onStart };
  next();
}

// 지금 대사를 바로 끊는다 (사용자가 엔터를 쳤을 때) — 기다리던 대사도 버린다
export function cut() {
  gen++;
  blocked = null;
  current?.pause();
  current = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  clearTimeout(timer);
  pending = null;
  playing = "";
  busyUntil = 0;
}

// 기다리는 대사까지 다 말하고 조용해지면 — 화면 전환이 목소리를 앞지르지 않게
export function whenQuiet(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (!pending && performance.now() >= busyUntil ? resolve() : setTimeout(check, 100));
    check();
  });
}

// 미리 받아 분석해 둔다 — 처음 나올 때 자막이 분석을 기다리지 않게 (결과만 남기고 소리 데이터는 버린다)
export const warm = (key: string, lines: number) => analyze(`/voice/${key}.mp3`, lines).catch(() => undefined);
