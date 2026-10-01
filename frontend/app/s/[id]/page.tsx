import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SharedShelf from "@/components/share/SharedShelf";
import { publicShelf } from "@/components/share/public";

/* 공유 링크로 들어온 서랍 — 누군가 서류함에서 건져 올린 곡들. 미리보기 이미지는 옆의 opengraph-image */

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const shelf = await publicShelf((await params).id);
  if (!shelf) return { title: "cabinet" };
  const title = `“${shelf.query || shelf.tag}” — cabinet`;
  const description = `서류함에서 건져 올린 ${shelf.tracks.length}곡 · ${shelf.tracks.slice(0, 3).map((t) => t.title).join(", ")}`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function SharedShelfPage({ params }: PageProps<"/s/[id]">) {
  const shelf = await publicShelf((await params).id);
  if (!shelf) notFound();
  return <SharedShelf shelf={shelf} />;
}
