import ArchiveRoom from "@/components/archive/ArchiveRoom";

export default async function ArchivePage({ searchParams }: PageProps<"/archive">) {
  const { new: fresh } = await searchParams;
  return <ArchiveRoom fresh={typeof fresh === "string" ? fresh : null} />;
}
