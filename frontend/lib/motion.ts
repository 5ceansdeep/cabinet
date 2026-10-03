import { useSyncExternalStore } from "react";

/* 움직임 줄이기(prefers-reduced-motion) — CSS 는 globals.css 가 끄지만 3D(useFrame)·캔버스 루프는 이걸 보고 직접 줄인다.
   연출은 없애지 않고 "움직임 → 상태 변화"로: 서랍·카드는 바로 도착, 들썩임·물결·뒤지기는 멈춤 (.claude/skills/design-rules) */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  const m = matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** 컴포넌트용 — 설정이 바뀌면 다시 그린다. 서버 렌더에선 false */
export const useReducedMotion = () => useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => false);

/** useFrame·루프 안에서 그때그때 — 훅을 못 쓰는 곳 */
export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia(QUERY).matches;

/** 프레임 속도와 무관한 감쇠 비율 — 매 프레임 x += (목표 - x) * damp(rate, dt). 감속 모드면 1(바로 도착) */
export const damp = (rate: number, dt: number, reduce = false) => (reduce ? 1 : 1 - Math.exp(-rate * dt));
