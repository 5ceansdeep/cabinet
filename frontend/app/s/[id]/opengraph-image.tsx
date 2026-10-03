import { ImageResponse } from "next/og";
import { OgCard } from "@/components/share/Card";
import { publicShelf } from "@/components/share/public";
import { art, fonts, paper } from "@/components/share/render";

/* 공유 링크 미리보기 — 카톡·DM 에 /s/:id 를 붙이면 뜨는 그림. 영수증 윗부분 + 좌우 앨범 표지(Card.tsx OgCard) */
export const alt = "cabinet: 서류함에서 건져 올린 곡들";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"; // 구김 그림을 받아 올 곳 — 이 함수엔 요청 주소가 안 들어온다
  const shelf = await publicShelf((await params).id);
  const tracks = (shelf?.tracks ?? []).map((t) => ({ title: t.title, artist: t.artist, artwork: art(t.artwork) }));
  return new ImageResponse(<OgCard q={shelf?.query || shelf?.tag || "서류함"} tag={shelf?.tag ?? ""} tracks={tracks} paper={await paper(origin)} />, { ...size, fonts: await fonts() });
}
