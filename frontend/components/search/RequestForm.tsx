"use client";

import { useState } from "react";

/* 흰 공간에 떠 있는 편지지 — 흰색과 그림자색뿐. 자연어 질의를 받는다 */
export default function RequestForm({ onType, onSubmit }: { onType: (formRect: DOMRect) => void; onSubmit: (query: string) => void }) {
  const [query, setQuery] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (query.trim()) onSubmit(query.trim());
      }}
      className="relative w-full max-w-xl rounded-[2px] bg-white px-10 py-12 font-letter text-[#343a40] shadow-[0_2px_6px_rgba(0,0,0,.04),0_30px_80px_rgba(0,0,0,.08)] animate-[rise_1.6s_cubic-bezier(.2,.8,.2,1)]"
    >
      <label htmlFor="q" className="sr-only">
        편지
      </label>
      <textarea
        id="q"
        rows={5}
        value={query}
        onKeyDown={(e) => {
          // Enter 제출, Shift+Enter 줄바꿈
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          onType(e.currentTarget.form!.getBoundingClientRect());
        }}
        placeholder="새벽 2시에 혼자 버스 타고 집에 갈 때 듣고 싶은, 너무 우울하지는 않은 몽환적인 한국 노래를 들려주세요."
        className="w-full resize-none bg-[repeating-linear-gradient(transparent,transparent_35px,rgba(0,0,0,.07)_36px)] bg-transparent text-base leading-9 outline-none placeholder:text-black/25"
      />
      <footer className="mt-8 flex items-end justify-between">
        <span className="text-sm text-black/35">— 서류함 앞에서</span>
        <button
          type="submit"
          disabled={!query.trim()}
          className="rounded-full border border-black/15 px-5 py-2 text-sm text-black/60 transition-colors hover:bg-black/[.03] disabled:opacity-30"
        >
          편지 부치기
        </button>
      </footer>
    </form>
  );
}
