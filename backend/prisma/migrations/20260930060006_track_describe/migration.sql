-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "describedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "embedding" TEXT,
ADD COLUMN     "hasLyrics" BOOLEAN;
