"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const LOGS = [
  "[SYSTEM] 구조적 문장 해석 중...",
  "[EMBEDDING] 음악 메타데이터 매칭 중...",
  "[VECTOR] 768차원 벡터 공간 탐색 중...",
  "[ARCHIVE] 앨범 이미지 색인 중...",
  "[AUDIO] 청음 음원 버퍼링 중...",
];

export default function AuthFlow({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("auth");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  /* 로딩 — ponytail: 백엔드 메타데이터 로딩이 없어 진행률을 흉내 낸다. 실제 fetch 진행률로 교체 */
  useEffect(() => {
    if (phase !== "loading") return;
    let n = 0;
    const id = setInterval(() => {
      n++;
      setLogs((l) => [...l.slice(-40), `${LOGS[n % LOGS.length]} ${String(n * 7919).slice(-6)}`]);
      setProgress(Math.min(100, n * 2));
      if (n >= 50) {
        clearInterval(id);
        thud(55);
        setPhase("dive");
      }
    }, 90);
    return () => clearInterval(id);
  }, [phase]);

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

      {phase === "loading" && <LoadingOverlay logs={logs} progress={progress} />}

      {/* Diving Link — 서랍의 어두운 속으로 빨려 들어가는 터널 */}
      {phase === "dive" && <div className="absolute inset-0 bg-[#0a0d14] animate-[dive_1.6s_ease-in_forwards]" />}
    </main>
  );
}
