import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* 카드 그림 공통 — 글꼴과, 남이 보낸 값을 다듬는 규칙. 공유 카드(app/api/share)와 링크 미리보기(app/s/[id]/opengraph-image)가 같이 쓴다 */

const files = new Map<string, Promise<Buffer>>();
const file = (name: string) => files.get(name) ?? files.set(name, readFile(join(process.cwd(), "app/fonts", name))).get(name)!; // 한 번만 읽는다
/** 영수증 구김 그림(public/paper-crumple.png) → data URL. Satori 는 주소를 못 읽고, Vercel 서버 함수엔 public/ 이 없을 수 있어
    자기 사이트에서 받아 온다(정적 파일은 CDN). 한 번 받은 건 다시 안 받는다. 못 받으면 구김 없이 */
let paperUrl: Promise<string | undefined> | null = null;
export const paper = (origin: string) =>
  (paperUrl ??= fetch(new URL("/paper-crumple.png", origin))
    .then(async (r) => (r.ok ? `data:image/png;base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` : undefined))
    .catch(() => undefined)
    .then((u) => (u ? u : ((paperUrl = null), undefined)))); // 실패면 다음에 다시

/** 고정폭 Plex Mono(영수증 — 영문·숫자) + 자막과 같은 조선굴림(한글은 이쪽으로 받친다) + Anton(영수증 로고) */
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
