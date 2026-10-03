"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PAGE_DIALOGUE as D } from "@/components/landing/lines";

/* 화면이 그리다 터졌을 때 — 다시 시도(같은 화면을 다시 불러 그린다) 또는 새 편지. 404 와 같은 흰 종이 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-white px-4 text-foreground">
      <section className="flex w-full max-w-md flex-col items-center gap-4 rounded-ui bg-white px-8 py-12 text-center font-letter shadow-[0_2px_6px_rgba(0,0,0,.04),0_30px_80px_rgba(0,0,0,.08)] animate-[appear_.3s_both]">
        <h1 className="text-xl">{D.ERROR}</h1>
        <p className="text-sm text-black/65">{D.ERROR_SUB}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => retry()} className="btn-solid">
            {D.RETRY}
          </button>
          <Link href="/search" className="btn">
            {D.WRITE}
          </Link>
        </div>
      </section>
    </main>
  );
}
