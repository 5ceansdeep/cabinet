-- AlterTable
ALTER TABLE "SearchLog" ADD COLUMN     "query" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tracks" TEXT NOT NULL DEFAULT '[]';
