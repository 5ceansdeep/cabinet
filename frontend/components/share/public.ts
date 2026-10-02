/* 공개 서랍 — 공유 링크(/s/:id) 페이지와 미리보기 이미지가 서버에서 읽는다(로그인 없이) */

export type PublicShelf = {
  id: string;
  tag: string;
  query: string;
  keywords?: string[]; // 그때 요청 해석 — 공유 카드 MOOD
  createdAt?: string;
  tracks: { id: string; title: string; artist: string; artwork: string | null; previewUrl: string | null; description?: string | null; semantic?: number | null }[];
  youtube: string | null; // 이미 찾아 둔 영상으로 만든 이어 듣기 링크
  missing: { title: string; artist: string; search: string }[]; // 영상을 아직 못 찾은 곡 — 곡별 유튜브 검색
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function publicShelf(id: string): Promise<PublicShelf | null> {
  if (!/^[\w-]{1,40}$/.test(id)) return null;
  const r = await fetch(`${API}/shelves/public/${id}`, { cache: "no-store" }).catch(() => null);
  return r?.ok ? ((await r.json()) as PublicShelf) : null;
}
