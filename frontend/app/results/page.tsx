import Results from "@/components/results/Results";
import { parseGenres } from "@/lib/genres";

export default async function ResultsPage({ searchParams }: PageProps<"/results">) {
  const { q, g } = await searchParams;
  return <Results query={typeof q === "string" ? q : ""} genres={parseGenres(g)} />;
}
