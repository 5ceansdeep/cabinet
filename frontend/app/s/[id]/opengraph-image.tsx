import { ImageResponse } from "next/og";
import { OgCard } from "@/components/share/Card";
import { publicShelf } from "@/components/share/public";
import { art, fonts } from "@/components/share/render";

/* 공유 링크 미리보기 — 카톡·DM 에 /s/:id 를 붙이면 뜨는 그림. 편지 문장 + 플로피 5장 */
export const alt = "cabinet — 서류함에서 건져 올린 곡들";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const shelf = await publicShelf((await params).id);
  const tracks = (shelf?.tracks ?? []).map((t) => ({ title: t.title, artist: t.artist, artwork: art(t.artwork) }));
  return new ImageResponse(<OgCard q={shelf?.query || shelf?.tag || "서류함"} tag={shelf?.tag ?? ""} tracks={tracks} />, { ...size, fonts: await fonts() });
}
