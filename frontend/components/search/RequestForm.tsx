"use client";

import { useState } from "react";

/* 서류함에서 방금 건져 올린 듯한 종이 서식 양식. 자연어 질의를 받는다 */
export default function RequestForm({ onType, onSubmit }: { onType: (formRect: DOMRect) => void; onSubmit: (query: string) => void }) {
  const [query, setQuery] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (query.trim()) onSubmit(query.trim());
      }}
      className="relative w-full max-w-xl rounded-sm border border-white/[.06] bg-data-surface p-8 shadow-[0_30px_80px_rgba(0,0,0,.5)] animate-[rise_1s_cubic-bezier(.2,.8,.2,1)]"
    >
      <header className="mb-6 flex justify-between border-b border-dashed border-white/10 pb-3 font-mono text-[10px] tracking-[.25em] text-foreground/50">
        <span>REQUEST FORM</span>
        <span>No. 0768</span>
      </header>
      <label htmlFor="q" className="mb-3 block font-mono text-xs text-foreground/70">
        지금 당신의 상황을 적어 주십시오.
      </label>
      <textarea
        id="q"
        rows={4}
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
        placeholder="새벽 2시에 혼자 버스 타고 집에 갈 때 듣고 싶은, 너무 우울하지는 않은 몽환적인 한국 노래"
        className="w-full resize-none bg-[repeating-linear-gradient(transparent,transparent_31px,rgba(226,232,240,.08)_32px)] bg-transparent text-base leading-8 outline-none placeholder:text-foreground/25"
      />
      <footer className="mt-4 flex items-center justify-between font-mono text-[10px] tracking-[.2em]">
        <span className="text-accent/70">768-DIM VECTOR SPACE</span>
        <button type="submit" disabled={!query.trim()} className="border border-accent/40 px-3 py-1.5 text-accent transition-colors hover:bg-accent/10 disabled:opacity-30">
          SUBMIT ⏎
        </button>
      </footer>
    </form>
  );
}
