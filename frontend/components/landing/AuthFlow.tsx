"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startChoir } from "@/lib/choir";
import { thud } from "@/lib/thud";
import CabinetScene, { type Field, type Phase } from "./CabinetScene";
import LoadingOverlay from "./LoadingOverlay";

/* 1·2번 흐름 — 인증(로그인/회원가입) → 로딩 → 서랍 속 다이브 → /search */

const FIELDS: Record<"login" | "signup", Field[]> = {
  login: [
    { name: "email", type: "email", label: "EMAIL" },
    { name: "password", type: "password", label: "PASSWORD" },
  ],
  signup: [
    { name: "email", type: "email", label: "EMAIL" },
    { name: "nickname", type: "text", label: "NICKNAME" },
    { name: "password", type: "password", label: "PASSWORD" },
  ],
};

export default function AuthFlow({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("auth");
  const [progress, setProgress] = useState(0);

  /* 로딩 — ponytail: 백엔드 메타데이터 로딩이 없어 진행률을 흉내 낸다. 실제 fetch 진행률로 교체 */
  useEffect(() => {
    if (phase !== "loading") return;
    let n = 0;
    const id = setInterval(() => {
      n++;
      setProgress(Math.min(100, n * 2));
      if (n >= 50) {
        clearInterval(id);
        thud(55);
        setPhase("dive");
      }
    }, 120);
    return () => clearInterval(id);
  }, [phase]);

  // 로딩 동안 성스러운 브금 — 로딩이 끝나면 cleanup 으로 페이드아웃
  useEffect(() => (phase === "loading" ? startChoir() : undefined), [phase]);

  useEffect(() => {
    if (phase !== "dive") return;
    const id = setTimeout(() => router.push("/search"), 1600);
    return () => clearTimeout(id);
  }, [phase, router]);

  return (
    <main className="relative h-screen overflow-hidden bg-background">
      {/* ponytail: 백엔드 인증 API 없음 — onDone 의 values 로 로그인/회원가입 요청 보내고 JWT 저장 */}
      <CabinetScene fields={FIELDS[mode]} phase={phase} onDone={() => setPhase("loading")} />

      {phase === "auth" && (
        <nav className="absolute inset-x-0 bottom-8 text-center font-mono text-[10px] tracking-[.25em] text-black/40">
          {mode === "login" ? (
            <Link href="/signup" className="hover:text-black/70">
              NEW HERE? — SIGN UP
            </Link>
          ) : (
            <Link href="/" className="hover:text-black/70">
              ALREADY FILED? — LOG IN
            </Link>
          )}
        </nav>
      )}

      {phase === "loading" && <LoadingOverlay progress={progress} />}

      {/* Diving Link — 서랍의 어두운 속으로 빨려 들어가는 터널 */}
      {phase === "dive" && <div className="absolute inset-0 bg-[#0a0d14] animate-[dive_1.6s_ease-in_forwards]" />}
    </main>
  );
}
