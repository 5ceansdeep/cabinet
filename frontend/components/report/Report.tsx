import Link from "next/link";
import type { Track } from "@/components/results/tracks";

/* 5.1번 — 빛바랜 종이 보고서. 디스크 한 장을 뜯어본 서브 뷰.
   ponytail: 아키비스트 AI 문장(docs/ai-report-plan.md)은 아직 없음 — 지금은 수치와 메타데이터만 인쇄한다 */

// 종이 — 누런 바탕에 섬유결(가로세로 옅은 줄)과 얼룩
const PAPER = [
  "radial-gradient(ellipse at 18% 12%, rgba(140,110,60,.10), transparent 45%)",
  "radial-gradient(ellipse at 82% 78%, rgba(120,95,50,.09), transparent 40%)",
  "repeating-linear-gradient(90deg, rgba(120,95,50,.035) 0 1px, transparent 1px 3px)",
  "repeating-linear-gradient(0deg, rgba(120,95,50,.03) 0 1px, transparent 1px 4px)",
  "linear-gradient(#f5efdd, #ece3cb)",
].join(",");

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-dashed border-[#8a7a55]/40 py-2">
      <dt className="w-28 shrink-0 text-[11px] tracking-[.2em] text-[#6b5d3f]">{label}</dt>
      <dd className="flex-1">{children}</dd>
    </div>
  );
}

/* 잉크 스탬프로 쾅 찍은 듯한 막대 — 눈금 위에 번진 잉크 한 칸 */
function Gauge({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-[11px] tracking-[.15em] text-[#6b5d3f]">{label}</span>
      <div className="relative h-5 flex-1 border border-[#6b5d3f]/50 bg-[repeating-linear-gradient(90deg,rgba(107,93,63,.25)_0_1px,transparent_1px_10%)]">
        <div
          className="h-full bg-[repeating-linear-gradient(45deg,#2f2a20_0_3px,#4a4234_3px_6px)] opacity-85"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-12 text-right text-sm tabular-nums">{value}%</span>
    </div>
  );
}

export default function Report({ track, query, no }: { track: Track; query: string; no: string }) {
  return (
    <main className="flex min-h-screen flex-1 justify-center bg-[#cfc7b4] px-4 py-10 font-mono text-[#2f2a20]">
      <article
        className="relative w-full max-w-2xl rotate-[-.35deg] p-10 shadow-[0_18px_50px_rgba(60,45,20,.35)] animate-[rise_.8s_cubic-bezier(.2,.8,.2,1)]"
        style={{ background: PAPER }}
      >
        {/* 분류 스탬프 — 붉은 잉크로 비뚜름하게 */}
        <p
          aria-hidden
          className="absolute top-8 right-8 rotate-[9deg] border-2 border-[#9c3b2e]/70 px-3 py-1 text-[11px] tracking-[.3em] text-[#9c3b2e]/70"
        >
          대외비
        </p>

        <header className="mb-8 border-b-2 border-double border-[#6b5d3f]/60 pb-4">
          <h1 className="text-lg tracking-[.25em]">감정 수사 보고서</h1>
          <p className="mt-2 text-[11px] tracking-[.2em] text-[#6b5d3f]">문서 번호 {no}</p>
        </header>

        <dl className="mb-8">
          <Row label="제목">{track.title}</Row>
          <Row label="연주">{track.artist}</Row>
          <Row label="보관 위치">서랍 {no.slice(0, 7)} · 행잉 폴더 {String(track.id).padStart(3, "0")}</Row>
        </dl>

        <section className="mb-8">
          <h2 className="mb-2 text-[11px] tracking-[.2em] text-[#6b5d3f]">접수된 요청문</h2>
          <blockquote className="border-l-2 border-[#6b5d3f]/50 bg-[repeating-linear-gradient(transparent,transparent_27px,rgba(107,93,63,.25)_28px)] py-1 pl-4 leading-7">
            {query || "(기록 없음)"}
          </blockquote>
        </section>

        <section className="mb-10 space-y-3">
          <h2 className="text-[11px] tracking-[.2em] text-[#6b5d3f]">대조 결과</h2>
          <Gauge label="의미 유사도" value={track.semantic} />
          <Gauge label="분위기 일치도" value={track.mood} />
        </section>

        <footer className="flex items-end justify-between border-t border-[#6b5d3f]/40 pt-4 text-[11px]">
          <p className="max-w-xs leading-5 text-[#6b5d3f]">이 서류는 내가 직접 서랍에서 꺼낸 것이네. 의심은 접어두게.</p>
          <Link href="/results" className="tracking-[.2em] text-[#6b5d3f] underline-offset-4 hover:underline">
            ← 서랍으로
          </Link>
        </footer>
      </article>
    </main>
  );
}
