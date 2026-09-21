import Results from "@/components/results/Results";

export default async function ResultsPage({ searchParams }: PageProps<"/results">) {
  const { q } = await searchParams;
  return <Results query={typeof q === "string" ? q : ""} />;
}
