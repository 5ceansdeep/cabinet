"use client";

import { useRouter } from "next/navigation";
import RequestForm from "@/components/search/RequestForm";
import { useParticles } from "@/components/search/useParticles";

/* 3번 페이지 — 후광이 화면을 하얗게 덮은 그 자리에서 편지를 쓴다. 순백과 그림자뿐, 따뜻한 색 없음 */
export default function SearchPage() {
  const router = useRouter();
  const { canvasRef, scatter } = useParticles();

  return (
    <main className="relative flex min-h-screen flex-1 items-center justify-center bg-white px-4 text-foreground">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 h-full w-full" />
      <RequestForm onType={scatter} onSubmit={(q) => router.push(`/results?q=${encodeURIComponent(q)}`)} />
    </main>
  );
}
