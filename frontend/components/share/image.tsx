import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import Card, { type ShareData } from "./Card";
import { fonts, paper } from "./render";

/* 공유 카드 PNG 그리기 — POST /api/share(브라우저에만 있는 서랍, 방금 결과)와 GET /api/share/:id(서버 서랍 — 같은 카드를 다시)가 같이 쓴다.
   QR 은 이 사이트의 공개 서랍(/s/:id) 또는 유튜브 이어 듣기(watch_videos)만 — 아무 주소나 QR 로 찍어 주지 않게 */

const YOUTUBE = /^https:\/\/www\.youtube\.com\/watch_videos\?video_ids=[\w,-]{11,600}$/;

export async function cardImage(data: Required<Pick<ShareData, "q" | "keywords" | "tracks">> & { link: string; date: Date; no: string }, origin: string, headers?: HeadersInit) {
  const shelf = new RegExp(String.raw`^${origin.replace(/[.]/g, String.raw`\.`)}/s/[\w-]{1,40}$`).test(data.link);
  const qr = shelf || YOUTUBE.test(data.link) ? await QRCode.toDataURL(data.link, { margin: 2, width: 400 }) : null;
  return new ImageResponse(
    <Card
      q={data.q}
      keywords={data.keywords}
      tracks={data.tracks}
      qr={qr}
      shelf={shelf}
      date={data.date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).toUpperCase()}
      no={data.no}
      paper={await paper(origin)}
    />,
    { width: 1080, height: 1920, fonts: await fonts(), headers },
  );
}
