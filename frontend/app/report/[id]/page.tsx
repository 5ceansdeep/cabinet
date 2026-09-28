import { notFound } from "next/navigation";

/* 5.1 보고서 — 지금은 꺼 둔다(2026-09-28). 되살리려면 아래 주석을 풀고, 결과 화면의 "보고서 열람" 링크와
   보관함에서 디스크를 눌렀을 때의 이동도 같이 푼다 (grep "보고서 꺼 둠").
   화면 조각은 components/report/Report.tsx 에 그대로 있다 */

// import Report from "@/components/report/Report";
// import { TRACKS } from "@/components/results/tracks";

export default async function ReportPage() {
  // export default async function ReportPage({ params, searchParams }: PageProps<"/report/[id]">) {
  //   const { id } = await params;
  //   const { q } = await searchParams;
  //   // ponytail: 저장된 탐험 기록이 없어 결과 페이지의 가짜 트랙에서 찾는다 — 백엔드 생기면 기록 id 로 fetch
  //   const track = TRACKS.find((t) => String(t.id) === id);
  //   if (!track) notFound();
  //   return <Report track={track} query={typeof q === "string" ? q : ""} no={`2026-B-${String(track.id).padStart(2, "0")}`} />;
  notFound();
}
