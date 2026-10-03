import type { Metadata } from "next";
import { Anton, IBM_Plex_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import SharedShelf from "@/components/share/SharedShelf";
import { publicShelf } from "@/components/share/public";

/* 공유 링크로 들어온 서랍 — 누군가 서류함에서 건져 올린 곡들(영수증 화면). 미리보기 이미지는 옆의 opengraph-image */

/* 영수증 글꼴 — 공유 카드와 같은 로고(Anton)·고정폭(Plex Mono). 이 화면에서만 쓰니 여기서만 받는다 */
const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const plex = IBM_Plex_Mono({ variable: "--font-plex", weight: ["400", "600"], subsets: ["latin"] });

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const shelf = await publicShelf((await params).id);
  if (!shelf) return { title: "cabinet" };
  const title = `“${shelf.query || shelf.tag}” | cabinet`;
  const description = `서류함에서 건져 올린 ${shelf.tracks.length}곡 · ${shelf.tracks.slice(0, 3).map((t) => t.title).join(", ")}`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function SharedShelfPage({ params }: PageProps<"/s/[id]">) {
  const shelf = await publicShelf((await params).id);
  if (!shelf) notFound();
  return (
    <div className={`${anton.variable} ${plex.variable} h-full`}>
      <SharedShelf shelf={shelf} />
    </div>
  );
}
