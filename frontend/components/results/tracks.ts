import { api } from "@/lib/api";

export type Track = {
  id: string;
  title: string;
  artist: string;
  semantic: number; // 요청과의 일치도 % (뜻 벡터 코사인 + 에너지·밝기 거리)
  cover: string; // 커버가 없거나 불러오는 동안 칠하는 그라디언트
  artwork?: string | null; // iTunes 앨범 커버
  previewUrl?: string | null; // iTunes 30초 미리듣기
  description?: string | null; // 곡 설명(감정/상황/가사/소리)
  reason?: string | null; // 신의 한마디와 같이 오는 한 줄 — 왜 이 요청에 이 곡인지 (디스크가 뜬 뒤 붙는다)
};

/** 신의 한마디 — ko 는 자막, en 은 음성(ElevenLabs 붙기 전엔 안 쓴다) */
export type GodLine = { ko: string; en: string; voice?: string | null }; // voice = 영어 음성 id (ElevenLabs 를 켰을 때만)
export type Found = { interpretation: string[]; tracks: Track[]; failed?: boolean }; // failed = 서버가 오류를 냈다

const GRADIENTS = [
  "linear-gradient(135deg,#1e3a5f,#8ec5fc)",
  "linear-gradient(135deg,#f6d365,#fda085)",
  "linear-gradient(135deg,#a18cd1,#fbc2eb)",
  "linear-gradient(135deg,#0f2027,#2c5364)",
  "linear-gradient(135deg,#43cea2,#185a9d)",
  "linear-gradient(135deg,#ff9a9e,#fecfef)",
];
const gradientOf = (id: string) => GRADIENTS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % GRADIENTS.length];

// 백엔드가 꺼져 있을 때 쓰는 가짜 곡 — 화면 목업이 서버 없이도 돌게
export const TRACKS: Track[] = [
  { id: "1", title: "Everything", artist: "검정치마", semantic: 87, cover: GRADIENTS[0] },
  { id: "2", title: "난춘", artist: "새소년", semantic: 84, cover: GRADIENTS[1] },
  { id: "3", title: "Square", artist: "백예린", semantic: 82, cover: GRADIENTS[2] },
  { id: "4", title: "TOMBOY", artist: "혁오", semantic: 79, cover: GRADIENTS[3] },
  { id: "5", title: "도망가자", artist: "선우정아", semantic: 77, cover: GRADIENTS[4] },
  { id: "6", title: "주저하는 연인들을 위해", artist: "잔나비", semantic: 74, cover: GRADIENTS[5] },
  { id: "7", title: "위잉위잉", artist: "혁오", semantic: 72, cover: GRADIENTS[3] },
  { id: "8", title: "Antifreeze", artist: "검정치마", semantic: 70, cover: GRADIENTS[0] },
  { id: "9", title: "밤편지", artist: "아이유", semantic: 68, cover: GRADIENTS[2] },
  { id: "10", title: "Hate you", artist: "백예린", semantic: 66, cover: GRADIENTS[5] },
  { id: "11", title: "한숨", artist: "이하이", semantic: 63, cover: GRADIENTS[4] },
  { id: "12", title: "비도 오고 그래서", artist: "헤이즈", semantic: 61, cover: GRADIENTS[1] },
];

type Scored = Omit<Track, "cover">;

/* 요청문으로 곡을 꺼낸다. seen = 이미 보여 준 곡(몇 곡 더), thrown = 던져 버린 곡(빼고 다시).
   서버에 아예 닿지 못하면(개발 중 백엔드를 안 켬) 가짜 곡에서 같은 규칙으로. 서버가 오류를 내면 가짜 곡으로 덮지 않고 failed —
   예전엔 오류도 가짜 곡으로 보여 줘서 결과처럼 보였다(9/30, 백엔드 재시작 중 요청) */
export async function findTracks(query: string, opt: { seen?: string[]; thrown?: string[]; genres?: string[] } = {}): Promise<Found> {
  const qs = new URLSearchParams({ q: query });
  if (opt.genres?.length) qs.set("g", opt.genres.join(","));
  if (opt.seen?.length) qs.set("seen", opt.seen.join(","));
  if (opt.thrown?.length) qs.set("thrown", opt.thrown.join(","));
  const r = await api<{ interpretation: string[]; tracks: Scored[] }>(`/recommend?${qs}`);
  if (r.ok) return { interpretation: r.data.interpretation, tracks: r.data.tracks.map((t) => ({ ...t, cover: gradientOf(t.id) })) };
  if (r.status !== 0) return { interpretation: [], tracks: [], failed: true };
  const skip = new Set([...(opt.seen ?? []), ...(opt.thrown ?? [])]);
  return { interpretation: [], tracks: TRACKS.filter((t) => !skip.has(t.id)).slice(0, 6) };
}

/* 보여 준 곡들을 건네는 신의 한마디 + 곡마다 이유 — 곡 목록보다 늦게(Gemini 한 번 더). 실패·서버 없음이면 없이 */
export async function findLine(query: string, ids: string[]): Promise<{ line: GodLine | null; reasons: Record<string, string> }> {
  const r = await api<{ line: GodLine | null; reasons: Record<string, string> }>(
    `/recommend/line?${new URLSearchParams({ q: query, ids: ids.join(",") })}`,
  );
  return r.ok ? r.data : { line: null, reasons: {} };
}

/* 곡 하나를 요청문에 대 본다 — 보고서. 백엔드가 없으면 가짜 곡에서 */
export async function findTrack(id: string, query: string): Promise<Track | null> {
  const r = await api<{ track: Scored }>(`/recommend/${encodeURIComponent(id)}?q=${encodeURIComponent(query)}`);
  if (r.ok) return { ...r.data.track, cover: gradientOf(r.data.track.id) };
  return TRACKS.find((t) => t.id === id) ?? null;
}

/** 던진 곡을 서버에 알린다 — 자주 던져지는 곡은 순위가 조금 내려간다. 결과는 기다리지 않는다(실패해도 화면은 그대로) */
export const logThrow = (id: string) => void api("/recommend/throw", { method: "POST", body: { id } });
