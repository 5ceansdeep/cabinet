-- CreateTable
CREATE TABLE "LetterLine" (
    "query" TEXT NOT NULL,
    "ko" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LetterLine_pkey" PRIMARY KEY ("query")
);
