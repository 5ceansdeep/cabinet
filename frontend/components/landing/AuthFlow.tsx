"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession, getSession, login, requestReset, signup, subscribeSession } from "@/lib/auth";
import { startChoir } from "@/lib/choir";
import { whenQuiet } from "@/lib/voice";
import { thud } from "@/lib/thud";
import CabinetScene, { type Phase } from "./CabinetScene";
import { FIELDS, LINES, NAV, type Line } from "./lines";
import { Halo } from "./LoadingOverlay";

/* 1·2번 흐름 — 인증(로그인/회원가입/열쇠 찾기) → 서랍 닫힘 → 후광이 화면을 하얗게 → /search(신에게 쓰는 편지) */

type Mode = keyof typeof FIELDS;
const CLOSE_MS = 700; // 서랍이 닫히는 동안 후광은 기다린다
const GREET_MS = 2600; // 환영 인사를 들려주고 나서 로딩 문구로

export default function AuthFlow({ mode }: { mode: Mode }) {
  const router = useRouter();
  const fields = FIELDS[mode];
  const [phase, setPhase] = useState<Phase>("auth");
  const [progress, setProgress] = useState(0);
  const [flow, setFlow] = useState<Line | null>(null); // 흐름 자막 — 대조 중·실패·환영·로딩

  // 이미 들어온 적 있으면 인사만 하고 곧장 편지로. "다른 이름으로" 누르면 세션을 지우고 평소대로
  const saved = useSyncExternalStore(subscribeSession, getSession, () => null);
  const [dismissed, setDismissed] = useState(false);
  const returning = mode === "login" && phase === "auth" && !dismissed ? saved : null;
  useEffect(() => {
    if (!returning) return;
    const id = setTimeout(() => setPhase("loading"), GREET_MS);
    return () => clearTimeout(id);
  }, [returning]);

  /* 로딩 — 서랍이 쾅 닫히고(CLOSE_MS) 나서야 후광이 차오른다. 대사가 끝날 즈음 100% — 화면이 온통 하얘지고, 그대로 편지(/search)로.
     ponytail: 백엔드 메타데이터 로딩이 없어 진행률을 흉내 낸다. 실제 fetch 진행률로 교체 */
  useEffect(() => {
    if (phase !== "loading") return;
    thud(55);
    let n = 0;
    let gone = false;
    let id: ReturnType<typeof setTimeout>;
    // 90% 까지 차오른 뒤엔 하던 말(환영·로딩 대사)이 끝나길 기다렸다가, 말이 끝날 즈음 마저 하얗게 덮고 넘어간다
    const tick = () => {
      setProgress(Math.min(100, ++n * 2));
      if (n < 50) id = setTimeout(tick, 120);
      else id = setTimeout(() => router.push("/search"), 800);
    };
    const rise = () => {
      if (n < 45) {
        setProgress(++n * 2);
        id = setTimeout(rise, 120);
      } else whenQuiet().then(() => !gone && tick());
    };
    id = setTimeout(rise, CLOSE_MS);
    const line = setTimeout(() => setFlow(LINES.loading), GREET_MS);
    return () => {
      gone = true;
      clearTimeout(id);
      clearTimeout(line);
    };
  }, [phase, router]);

  // 로딩 동안 성스러운 브금 — 페이지를 떠나면 cleanup 으로 페이드아웃
  useEffect(() => (phase === "loading" ? startChoir() : undefined), [phase]);

  /* 모든 파일을 받았다 — 대조하고, 실패면 다시 받을 파일 번호를 돌려준다 */
  async function done(values: Record<string, string>): Promise<number | null> {
    setFlow(LINES.checking);
    const email = values.email.trim().toLowerCase();
    const last = fields.length - 1;

    if (mode === "forgot") {
      const r = await requestReset();
      await whenQuiet(); // "서류 정리 중이네"를 끝까지 듣고 나서 결과로
      setFlow(r.ok ? LINES.resetSent : LINES.server);
      return r.ok ? null : last;
    }

    const r = mode === "login" ? await login(email, values.password) : await signup(email, values.nickname, values.password);
    await whenQuiet(); // "서류 정리 중이네"를 끝까지 듣고 나서 결과(환영·꾸지람)로 — 화면이 목소리를 앞지르지 않게
    if (r.ok) {
      setFlow((mode === "login" ? LINES.welcomeBack : LINES.welcomeNew)(r.nickname));
      setPhase("loading");
      return null;
    }
    const passwordStep = fields.findIndex((f) => f.name === "password");
    const [line, back]: [Line, number] =
      r.reason === "wrong"
        ? [LINES.wrong, passwordStep]
        : r.reason === "noAccount"
          ? [LINES.noAccount, 0]
          : r.reason === "emailTaken"
            ? [LINES.emailTaken, 0]
            : [LINES.server, last]; // 쓴 값은 그대로 두고 Enter 로 다시
    setFlow(line);
    return back;
  }

  const glow = progress / 100;
  const link = "hover:text-black/70";

  return (
    <main className="relative h-screen overflow-hidden bg-background">
      {phase === "loading" && <Halo behind p={glow} />}
      <CabinetScene
        fields={fields}
        intro={LINES.intro[mode]}
        phase={phase}
        flow={returning ? LINES.returning(returning) : flow}
        onClearFlow={() => setFlow(null)}
        onDone={done}
      />
      {phase === "loading" && <Halo p={glow} />}

      {phase === "auth" && (
        <nav className="absolute top-8 right-8 flex flex-col items-end gap-2 font-letter text-xs tracking-wide text-black/45">
          {returning ? (
            <button
              className={link}
              onClick={() => {
                clearSession();
                setDismissed(true);
              }}
            >
              {NAV.notMe(returning)}
            </button>
          ) : mode === "login" ? (
            <>
              <Link href="/signup" className={link}>
                {NAV.signup}
              </Link>
              <Link href="/forgot" className={link}>
                {NAV.forgot}
              </Link>
            </>
          ) : (
            <Link href="/" className={link}>
              {mode === "signup" ? NAV.login : NAV.back}
            </Link>
          )}
        </nav>
      )}

      {phase === "loading" && (
        <p aria-live="polite" className="absolute inset-x-0 bottom-8 text-center font-mono text-[10px] tracking-[.3em] text-white/40">
          {progress}%
        </p>
      )}
    </main>
  );
}
