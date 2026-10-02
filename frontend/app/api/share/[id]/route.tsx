import { cardImage } from "@/components/share/image";
import { publicShelf } from "@/components/share/public";
import { art, pct } from "@/components/share/render";

/* 서버 서랍의 공유 카드 — 서랍에 남긴 편지·요청 해석·일치도로 그린다. 날짜는 서랍을 만든 날, 주문 번호는 서랍 id 에서 —
   그래서 언제 그려도 같은 카드다. 10/2 테스터: "한 번 만든 카드를 다시 보고 싶다" + 보관함에서 다시 그리는 데 5~9초.
   Vercel 이 한 번 그린 그림을 오래 기억한다(s-maxage). ponytail: 서랍 이름표를 바꿔도 카드엔 안 나와 캐시를 비울 일이 없다 */

const no = (id: string) => String([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 10000, 7)).padStart(4, "0");

export async function GET(req: Request, { params }: RouteContext<"/api/share/[id]">) {
  const { id } = await params;
  const shelf = await publicShelf(id);
  if (!shelf) return new Response("그런 서랍은 없어요", { status: 404 });
  const origin = new URL(req.url).origin;
  return cardImage(
    {
      q: (shelf.query || shelf.tag).slice(0, 120),
      keywords: (shelf.keywords ?? []).slice(0, 5),
      tracks: shelf.tracks.slice(0, 10).map((t) => ({ title: t.title, artist: t.artist, artwork: art(t.artwork), semantic: pct(t.semantic) })),
      link: `${origin}/s/${shelf.id}`,
      date: shelf.createdAt ? new Date(shelf.createdAt) : new Date(),
      no: no(shelf.id),
    },
    origin,
    { "cache-control": "public, max-age=3600, s-maxage=31536000, immutable" },
  );
}
