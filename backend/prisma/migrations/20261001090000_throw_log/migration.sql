-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "instrumental" BOOLEAN;

-- CreateTable
CREATE TABLE "ThrowLog" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThrowLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThrowLog_createdAt_idx" ON "ThrowLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ThrowLog" ADD CONSTRAINT "ThrowLog_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
