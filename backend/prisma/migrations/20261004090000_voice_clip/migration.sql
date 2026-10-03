-- CreateTable
CREATE TABLE "VoiceClip" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audio" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceClip_pkey" PRIMARY KEY ("id")
);
