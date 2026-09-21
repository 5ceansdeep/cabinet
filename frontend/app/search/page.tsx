"use client";

import { useRouter } from "next/navigation";
import RequestForm from "@/components/search/RequestForm";
import { useParticles } from "@/components/search/useParticles";

/* 3번 페이지 — 터널을 지나 도착한 Deep Data Void 에서 자연어로 상황을 고한다. */
export default function SearchPage() {
  const router = useRouter();
  const { canvasRef, scatter } = useParticles();

  return (
    <main data-theme="void" className="relative flex min-h-screen flex-1 items-center justify-center bg-background px-4 text-foreground">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 h-full w-full" />
      <RequestForm onType={scatter} onSubmit={(q) => router.push(`/results?q=${encodeURIComponent(q)}`)} />
    </main>
  );
}
