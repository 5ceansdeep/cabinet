import { useSyncExternalStore } from "react";

/* 화면 생김새 — 폰 대응. 모양만 다르면 CSS(portrait: · pointer-coarse:)로 하고, 동작이 달라야 할 때만 이걸 쓴다.
   서버 렌더에선 false(넓은 화면·마우스) */
function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/** 세로 화면(폰을 세워 든 것) — 영화 프레임 없이 창 전체를 쓴다 */
export const usePortrait = () => useMedia("(orientation: portrait)");
/** 호버가 없는 화면(터치) — 호버로 보여 주던 것을 다른 계기로 보여 준다 */
export const useTouch = () => useMedia("(hover: none)");

/** 민 것으로 칠 만큼인가 — a 방향으로 SWIPE_PX 넘게, 그리고 그 방향이 뚜렷할 때만(비스듬히 던지는 손놀림과 안 겹치게) */
const SWIPE_PX = 40;
export const swiped = (a: number, b: number) => Math.abs(a) > SWIPE_PX && Math.abs(a) > 1.5 * Math.abs(b);

/** 폰은 휠도 화살표 키도 없다 — 3D(캔버스) 위를 손가락·펜으로 민 것을 듣는다. 뗄 때 한 번, 민 거리(px)를 준다.
    마우스로 끄는 건 디스크 돌리기라 안 듣는다. 돌려주는 함수로 끈다(useEffect 정리) */
export function onSwipe(cb: (dx: number, dy: number) => void) {
  let from: { x: number; y: number } | null = null;
  const down = (e: PointerEvent) => {
    from = e.pointerType !== "mouse" && (e.target as HTMLElement).tagName === "CANVAS" ? { x: e.clientX, y: e.clientY } : null;
  };
  const up = (e: PointerEvent) => {
    if (!from) return;
    const { x, y } = from;
    from = null;
    cb(e.clientX - x, e.clientY - y);
  };
  const cancel = () => (from = null);
  addEventListener("pointerdown", down);
  addEventListener("pointerup", up);
  addEventListener("pointercancel", cancel);
  return () => {
    removeEventListener("pointerdown", down);
    removeEventListener("pointerup", up);
    removeEventListener("pointercancel", cancel);
  };
}
