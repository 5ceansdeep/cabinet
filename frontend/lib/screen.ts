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
