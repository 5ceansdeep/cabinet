"use client";

import { Heart } from "@phosphor-icons/react";
import { RESULT_DIALOGUE } from "@/components/landing/lines";
import { canLike, toggleLike, useLikes } from "@/lib/likes";

/* 곡 좋아요 — 하트. 서랍에 넣기(줄 전체)와 달리 곡 하나를 남긴다(10/7 베타 요청). 로그인 안 했으면 안 보인다 */
export default function LikeButton({ trackId, query, className = "" }: { trackId: string; query?: string; className?: string }) {
  const on = useLikes().has(trackId);
  if (!canLike()) return null;
  return (
    <button
      type="button"
      onClick={() => toggleLike(trackId, query)}
      aria-pressed={on}
      aria-label={on ? RESULT_DIALOGUE.UNLIKE : RESULT_DIALOGUE.LIKE}
      className={`grid size-[2em] shrink-0 place-items-center rounded-full transition-colors active:scale-[.9] pointer-coarse:size-10 ${on ? "text-accent" : "text-foreground/45 hover:text-foreground"} ${className}`}
    >
      <Heart aria-hidden weight={on ? "fill" : "regular"} className="size-[1.1em]" />
    </button>
  );
}
