"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startChoir } from "@/lib/choir";
import { thud } from "@/lib/thud";
import CabinetScene, { type Field, type Phase } from "./CabinetScene";
import LoadingOverlay, { Halo } from "./LoadingOverlay";

/* 1·2번 흐름 — 인증(로그인/회원가입) → 서랍 닫힘 → 후광이 화면을 하얗게 → /search(신에게 쓰는 편지) */

const CLOSE_MS = 700; // 서랍이 닫히는 동안 후광은 기다린다

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

  /* 로딩 — 서랍이 쾅 닫히고(CLOSE_MS) 나서야 후광이 차오른다. 100% 면 화면은 온통 하얗고, 그대로 편지(/search)로.
     ponytail: 백엔드 메타데이터 로딩이 없어 진행률을 흉내 낸다. 실제 fetch 진행률로 교체 */
  useEffect(() => {
    if (phase !== "loading") return;
    thud(55);
    let n = 0;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      setProgress(Math.min(100, ++n * 2));
      id = n < 50 ? setTimeout(tick, 120) : setTimeout(() => router.push("/search"), 800);
    };
    id = setTimeout(tick, CLOSE_MS);
    return () => clearTimeout(id);
  }, [phase, router]);

  // 로딩 동안 성스러운 브금 — 페이지를 떠나면 cleanup 으로 페이드아웃
  useEffect(() => (phase === "loading" ? startChoir() : undefined), [phase]);

  const glow = progress / 100;

  return (
    <main className="relative h-screen overflow-hidden bg-background">
      {phase === "loading" && <Halo behind p={glow} />}
      {/* ponytail: 백엔드 인증 API 없음 — onDone 의 values 로 로그인/회원가입 요청 보내고 JWT 저장 */}
      <CabinetScene fields={FIELDS[mode]} phase={phase} onDone={() => setPhase("loading")} />
      {phase === "loading" && <Halo p={glow} />}

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
    </main>
  );
}
