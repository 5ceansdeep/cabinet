-- AlterTable
ALTER TABLE "Shelf" ADD COLUMN     "keywords" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ShelfTrack" ADD COLUMN     "semantic" INTEGER;
