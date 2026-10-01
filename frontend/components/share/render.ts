import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* 카드 그림 공통 — 글꼴과, 남이 보낸 값을 다듬는 규칙. 공유 카드(app/api/share)와 링크 미리보기(app/s/[id]/opengraph-image)가 같이 쓴다 */

let font: Promise<Buffer> | null = null;
/** 자막과 같은 조선굴림체 — 한 번만 읽는다 */
export const fonts = async () => [{ name: "Chosun", data: await (font ??= readFile(join(process.cwd(), "app/fonts/ChosunGu.woff"))), weight: 400 as const, style: "normal" as const }];

const ART = /^https:\/\/is\d+-ssl\.mzstatic\.com\//;
/** 표지는 iTunes 주소만(남의 주소로 서버가 아무 그림이나 받아 오지 않게), 카드엔 300px 이면 된다 */
export const art = (v: unknown) => (typeof v === "string" && ART.test(v) ? v.replace("600x600bb", "300x300bb") : null);
export const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
