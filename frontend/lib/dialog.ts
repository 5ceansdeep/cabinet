import { useEffect, useRef } from "react";

/* 오버레이(곡 시트·공유 카드)를 대화상자처럼 — 열리면 안의 첫 버튼으로 포커스, Tab 은 안에서만 돌고, ESC 로 닫고,
   닫히면 열기 전 자리로 포커스를 돌려준다(키보드·스크린리더 사용자가 길을 잃지 않게 — 디자인 규칙 접근성) */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const box = ref.current;
    (box?.querySelector<HTMLElement>(FOCUSABLE) ?? box)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close.current();
      if (e.key !== "Tab" || !box) return;
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return e.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  return ref;
}
