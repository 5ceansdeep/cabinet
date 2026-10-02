import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* 카드 그림 공통 — 글꼴과, 남이 보낸 값을 다듬는 규칙. 공유 카드(app/api/share)와 링크 미리보기(app/s/[id]/opengraph-image)가 같이 쓴다 */

const files = new Map<string, Promise<Buffer>>();
const file = (name: string) => files.get(name) ?? files.set(name, readFile(join(process.cwd(), "app/fonts", name))).get(name)!; // 한 번만 읽는다
/** 고정폭 Plex Mono(영수증 — 영문·숫자) + 자막과 같은 조선굴림(한글은 이쪽으로 받친다) */
export const fonts = async () => [
  { name: "Mono", data: await file("IBMPlexMono-Regular.ttf"), weight: 400 as const, style: "normal" as const },
  { name: "Mono", data: await file("IBMPlexMono-SemiBold.ttf"), weight: 600 as const, style: "normal" as const },
  { name: "Chosun", data: await file("ChosunGu.woff"), weight: 400 as const, style: "normal" as const },
  { name: "Anton", data: await file("Anton-Regular.ttf"), weight: 400 as const, style: "normal" as const }, // 영수증 로고
];

const ART = /^https:\/\/is\d+-ssl\.mzstatic\.com\//;
/** 표지는 iTunes 주소만(남의 주소로 서버가 아무 그림이나 받아 오지 않게), 카드엔 300px 이면 된다 */
export const art = (v: unknown) => (typeof v === "string" && ART.test(v) ? v.replace("600x600bb", "300x300bb") : null);
export const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
