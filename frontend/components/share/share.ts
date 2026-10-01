import type { ShareData } from "./Card";

/* 공유 카드를 받아 — 휴대폰이면 공유 창(인스타 스토리로 바로), 아니면 PNG 로 내려받는다.
   'shared' 공유 창으로 보냄 / 'saved' 내려받음 / 'cancel' 공유 창을 닫음 / null 카드를 못 만듦 */
export async function shareCard(data: ShareData): Promise<"shared" | "saved" | "cancel" | null> {
  const res = await fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }).catch(() => null);
  if (!res?.ok) return null;
  const file = new File([await res.blob()], "cabinet.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "cabinet" });
      return "shared";
    } catch {
      return "cancel"; // 사용자가 닫았다
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = "cabinet.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "saved";
}
