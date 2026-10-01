-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetHash" TEXT,
ADD COLUMN     "resetUntil" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_resetHash_key" ON "User"("resetHash");
