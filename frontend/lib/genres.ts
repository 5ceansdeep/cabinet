/* 편지지에서 고르는 장르 — 키는 백엔드 backend/src/catalog/genres.ts 의 GENRES 와 같다(키를 바꾸면 둘 다).
   겹치는 장르는 하나로 묶었다: 인디 팝·인디 록·k-indie → 인디, 하우스·EDM·디스코 → 하우스·일렉, 랩 → 힙합 */
export const GENRES = [
  { key: "kpop", label: "케이팝" },
  { key: "pop", label: "팝" },
  { key: "indie", label: "인디" },
  { key: "rock", label: "록·밴드" },
  { key: "ballad", label: "발라드·어쿠스틱" },
  { key: "rnb", label: "알앤비·소울" },
  { key: "hiphop", label: "힙합" },
  { key: "house", label: "하우스·일렉" },
  { key: "jazz", label: "재즈" },
  { key: "jpop", label: "제이팝" },
  { key: "chanson", label: "샹송" },
] as const;

const LABEL = new Map<string, string>(GENRES.map((g) => [g.key, g.label]));

/** URL 의 g=jazz,house → 아는 키만 */
export const parseGenres = (g: unknown) => (typeof g === "string" ? g.split(",").filter((k) => LABEL.has(k)) : []);
export const genreLabel = (key: string) => LABEL.get(key) ?? key;
