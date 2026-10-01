import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import Card, { type ShareData } from "@/components/share/Card";

/* 공유 카드 PNG — 화면이 곡 정보를 보내면(POST) 1080×1920 이미지로 그려 돌려준다.
   표지는 iTunes 주소만 받는다(남의 주소로 서버가 아무 그림이나 받아 오지 않게). 글자 수·곡 수도 자른다 */

const font = readFile(join(process.cwd(), "app/fonts/ChosunGu.woff")); // 자막과 같은 조선굴림체
const ART = /^https:\/\/is\d+-ssl\.mzstatic\.com\//;
const YOUTUBE = /^https:\/\/www\.youtube\.com\/watch_videos\?video_ids=[\w,-]{11,600}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<ShareData> | null;
  if (!body || !Array.isArray(body.tracks)) return new Response("곡이 없네", { status: 400 });
  const data: ShareData = {
    q: str(body.q, 120),
    keywords: (Array.isArray(body.keywords) ? body.keywords : []).slice(0, 5).map((k) => str(k, 20)),
    line: str(body.line, 140) || null,
    tracks: body.tracks.slice(0, 10).map((t) => ({
      title: str(t?.title, 80),
      artist: str(t?.artist, 60),
      artwork: typeof t?.artwork === "string" && ART.test(t.artwork) ? t.artwork.replace("600x600bb", "300x300bb") : null,
    })),
  };
  // 유튜브 이어 듣기 QR — watch_videos 링크만(아무 주소나 QR 로 찍어 주지 않게)
  const qr = typeof body.youtube === "string" && YOUTUBE.test(body.youtube) ? await QRCode.toDataURL(body.youtube, { margin: 2, width: 400 }) : null;
  return new ImageResponse(<Card {...data} qr={qr} />, {
    width: 1080,
    height: 1920,
    fonts: [{ name: "Chosun", data: await font, weight: 400, style: "normal" }],
  });
}
