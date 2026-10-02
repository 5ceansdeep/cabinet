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
export type Found = { interpretation: string[]; tracks: Track[]; line?: GodLine | null; failed?: boolean; missingArtist?: string | null; kinArtists?: string[]; kinFor?: string | null; missingSong?: string | null }; // missingArtist = 편지에 쓴 가수 곡이 서류함에 없다 // failed = 서버가 오류를 냈다. 곡별 이유는 tracks[].reason

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
   서버가 오류를 내면 가짜 곡으로 덮지 않고 failed — 예전엔 오류도 가짜 곡으로 보여 줘서 결과처럼 보였다(9/30, 백엔드 재시작 중 요청).
   못 닿거나 5xx 면 한 번 더 부른다(배포 중 Railway 502 는 CORS 헤더가 없어 브라우저엔 "못 닿음"으로 보인다).
   가짜 곡은 개발 중 백엔드를 안 켰을 때만 — 배포에서 못 닿으면 failed(다시 뒤지기). 10/2 사용자: 목데이터 띄우지 말 것 */
export async function findTracks(query: string, opt: { seen?: string[]; thrown?: string[] } = {}): Promise<Found> {
  const qs = new URLSearchParams({ q: query });
  if (opt.seen?.length) qs.set("seen", opt.seen.join(","));
  if (opt.thrown?.length) qs.set("thrown", opt.thrown.join(","));
  const get = () => api<{ interpretation: string[]; tracks: Scored[]; line: GodLine | null; missingArtist?: string | null; kinArtists?: string[]; kinFor?: string | null; missingSong?: string | null }>(`/recommend?${qs}`);
  let r = await get();
  if (!r.ok && (r.status === 0 || r.status >= 500)) {
    await new Promise((ok) => setTimeout(ok, 1500));
    r = await get();
  }
  if (r.ok) {
    r.data.tracks.forEach((t) => t.artwork && void loadArt(t.artwork)); // 표지는 곡 목록을 받자마자 — 3D 디스크가 생길 때 받으면 늦다
    return { interpretation: r.data.interpretation, line: r.data.line, missingArtist: r.data.missingArtist, kinArtists: r.data.kinArtists ?? [], kinFor: r.data.kinFor, missingSong: r.data.missingSong, tracks: r.data.tracks.map((t) => ({ ...t, cover: gradientOf(t.id) })) };
  }
  if (r.status !== 0 || process.env.NODE_ENV === "production") return { interpretation: [], tracks: [], failed: true };
  const skip = new Set([...(opt.seen ?? []), ...(opt.thrown ?? [])]);
  return { interpretation: [], tracks: TRACKS.filter((t) => !skip.has(t.id)).slice(0, 10) };
}

/* 디스크 라벨에 그릴 앨범 표지 — 한 번 받은 그림은 다시 받지 않는다(같은 Image 를 돌려준다).
   라벨은 512px 캔버스의 위칸이라 600px 대신 400px 로 받는다 — 표지 무게가 절반 아래로.
   iTunes 표지는 CORS 를 열어 둬 캔버스에 그려도 된다 */
const arts = new Map<string, Promise<HTMLImageElement>>();
export function loadArt(artwork: string) {
  const url = artwork.replace("600x600bb", "400x400bb");
  let p = arts.get(url);
  if (!p) {
    p = new Promise((ok, no) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => ok(img);
      img.onerror = no;
      img.src = url;
    });
    p.catch(() => arts.delete(url)); // 실패면 다음에 다시
    arts.set(url, p);
  }
  return p;
}

/* 곡 하나를 요청문에 대 본다 — 보고서. 백엔드가 없으면 가짜 곡에서 */
export async function findTrack(id: string, query: string): Promise<Track | null> {
  const r = await api<{ track: Scored }>(`/recommend/${encodeURIComponent(id)}?q=${encodeURIComponent(query)}`);
  if (r.ok) return { ...r.data.track, cover: gradientOf(r.data.track.id) };
  return TRACKS.find((t) => t.id === id) ?? null;
}

/** 던진 곡을 서버에 알린다 — 자주 던져지는 곡은 순위가 조금 내려간다. 결과는 기다리지 않는다(실패해도 화면은 그대로) */
export const logThrow = (id: string) => void api("/recommend/throw", { method: "POST", body: { id } });
