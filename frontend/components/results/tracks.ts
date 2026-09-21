export type Track = { id: number; title: string; artist: string; semantic: number; mood: number; cover: string };

// ponytail: 가짜 데이터 — 백엔드 벡터 검색 API 생기면 query 로 fetch 해서 교체
export const TRACKS: Track[] = [
  { id: 1, title: "Everything", artist: "검정치마", semantic: 87, mood: 91, cover: "linear-gradient(135deg,#1e3a5f,#8ec5fc)" },
  { id: 2, title: "난춘", artist: "새소년", semantic: 84, mood: 88, cover: "linear-gradient(135deg,#f6d365,#fda085)" },
  { id: 3, title: "Square", artist: "백예린", semantic: 82, mood: 90, cover: "linear-gradient(135deg,#a18cd1,#fbc2eb)" },
  { id: 4, title: "TOMBOY", artist: "혁오", semantic: 79, mood: 85, cover: "linear-gradient(135deg,#0f2027,#2c5364)" },
  { id: 5, title: "도망가자", artist: "선우정아", semantic: 77, mood: 83, cover: "linear-gradient(135deg,#43cea2,#185a9d)" },
  { id: 6, title: "주저하는 연인들을 위해", artist: "잔나비", semantic: 74, mood: 80, cover: "linear-gradient(135deg,#ff9a9e,#fecfef)" },
];
