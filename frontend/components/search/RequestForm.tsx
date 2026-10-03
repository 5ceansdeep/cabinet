"use client";

import { useState } from "react";
import { LETTER } from "@/components/landing/lines";

/* 흰 공간에 떠 있는 편지지 — 흰색과 그림자색뿐. 편지(자연어 질의)만 받는다.
   10/2 장르 칩을 뺐다 — 편지에 "재즈 듣고 싶어"처럼 쓰면 서버가 알아서 그 장르로 거른다(겹치는 기능이었다) */
export default function RequestForm({
  onType,
  onSubmit,
}: {
  onType: (formRect: DOMRect) => void;
  onSubmit: (query: string) => void;
}) {
  const [query, setQuery] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (query.trim()) onSubmit(query.trim());
      }}
      // 반응형 — 글자 크기를 프레임 높이(cqh)에 맞추고, 폭·여백·줄 간격은 글자 크기(em)를 따라간다. 노트북이든 큰 모니터든 같은 비율
      className="relative w-[min(92cqw,34em)] rounded-[2px] bg-white px-[2.4em] py-[2.6em] font-letter text-[clamp(13px,2.2cqh,20px)] text-[#343a40] shadow-[0_2px_6px_rgba(0,0,0,.04),0_30px_80px_rgba(0,0,0,.08)] transition-shadow duration-200 animate-[rise_1.6s_cubic-bezier(.2,.8,.2,1)] has-[textarea:focus-visible]:shadow-[0_2px_6px_rgba(0,0,0,.08),0_30px_80px_rgba(0,0,0,.16),0_0_0_1px_rgba(0,0,0,.12)]"
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
        placeholder={LETTER.GUIDE}
        className="w-full resize-none bg-[repeating-linear-gradient(transparent,transparent_calc(2.25em-1.5px),rgba(0,0,0,.07)_2.25em)] bg-transparent text-[1em] leading-[2.25em] outline-none placeholder:text-black/60"
      />
      <footer className="mt-[1.6em] flex items-end justify-between">
        <span className="text-[.85em] text-black/60">{LETTER.SIGN}</span>
        <button
          type="submit"
          disabled={!query.trim()}
          className="btn"
        >
          {LETTER.SEND}
        </button>
      </footer>
    </form>
  );
}
