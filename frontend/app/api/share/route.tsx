import type { ShareData } from "@/components/share/Card";
import { cardImage } from "@/components/share/image";
import { art, pct, str } from "@/components/share/render";

/* 공유 카드 PNG — 화면이 곡 정보를 보내면(POST) 1080×1920 이미지로 그려 돌려준다. 브라우저에만 있는 서랍용 —
   서버 서랍은 GET /api/share/:id(같은 카드를 다시, 캐시). 글자 수·곡 수는 자른다 */

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<ShareData> | null;
  if (!body || !Array.isArray(body.tracks)) return new Response("곡이 없어요", { status: 400 });
  return cardImage(
    {
      q: str(body.q, 120),
      keywords: (Array.isArray(body.keywords) ? body.keywords : []).slice(0, 5).map((k) => str(k, 20)),
      tracks: body.tracks.slice(0, 10).map((t) => ({ title: str(t?.title, 80), artist: str(t?.artist, 60), artwork: art(t?.artwork), semantic: pct(t?.semantic) })),
      link: typeof body.link === "string" ? body.link : "",
      date: new Date(),
      no: String(Date.now() % 10000).padStart(4, "0"),
    },
    new URL(req.url).origin,
  );
}
