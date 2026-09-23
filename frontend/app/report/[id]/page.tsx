import { notFound } from "next/navigation";
import Report from "@/components/report/Report";
import { TRACKS } from "@/components/results/tracks";

export default async function ReportPage({ params, searchParams }: PageProps<"/report/[id]">) {
  const { id } = await params;
  const { q } = await searchParams;
  // ponytail: 저장된 탐험 기록이 없어 결과 페이지의 가짜 트랙에서 찾는다 — 백엔드 생기면 기록 id 로 fetch
  const track = TRACKS.find((t) => String(t.id) === id);
  if (!track) notFound();
  return <Report track={track} query={typeof q === "string" ? q : ""} no={`2026-B-${String(track.id).padStart(2, "0")}`} />;
}
