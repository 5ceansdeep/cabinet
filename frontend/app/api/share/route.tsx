import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import Card, { type ShareData } from "@/components/share/Card";
import { art, fonts, paper, str } from "@/components/share/render";

/* 공유 카드 PNG — 화면이 곡 정보를 보내면(POST) 1080×1920 이미지로 그려 돌려준다.
   QR 은 이 사이트의 공개 서랍(/s/:id) 또는 유튜브 이어 듣기(watch_videos)만 — 아무 주소나 QR 로 찍어 주지 않게. 글자 수·곡 수도 자른다 */

/** 일치도는 0~100 정수만 */
const pct = (v: unknown) => (typeof v === "number" && v > 0 && v <= 100 ? Math.round(v) : undefined);

const YOUTUBE = /^https:\/\/www\.youtube\.com\/watch_videos\?video_ids=[\w,-]{11,600}$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<ShareData> | null;
  if (!body || !Array.isArray(body.tracks)) return new Response("곡이 없네", { status: 400 });
  const shelfLink = new RegExp(`^${new URL(req.url).origin.replace(/[.]/g, "\\.")}/s/[\\w-]{1,40}$`);
  const link = typeof body.link === "string" ? body.link : "";
  const shelf = shelfLink.test(link);
  const qr = shelf || YOUTUBE.test(link) ? await QRCode.toDataURL(link, { margin: 2, width: 400 }) : null;
  return new ImageResponse(
    <Card
      q={str(body.q, 120)}
      keywords={(Array.isArray(body.keywords) ? body.keywords : []).slice(0, 5).map((k) => str(k, 20))}
      line={str(body.line, 140) || null}
      tracks={body.tracks.slice(0, 10).map((t) => ({ title: str(t?.title, 80), artist: str(t?.artist, 60), artwork: art(t?.artwork), semantic: pct(t?.semantic) }))}
      qr={qr}
      shelf={shelf}
      date={new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).toUpperCase()}
      no={String(Date.now() % 10000).padStart(4, "0")}
      paper={await paper(new URL(req.url).origin)}
    />,
    { width: 1080, height: 1920, fonts: await fonts() },
  );
}
