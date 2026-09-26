-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "artwork" TEXT,
    "previewUrl" TEXT,
    "videoId" TEXT,
    "checkedAt" DATETIME,
    "tags" TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO "new_Track" ("artist", "artwork", "checkedAt", "id", "previewUrl", "title", "videoId") SELECT "artist", "artwork", "checkedAt", "id", "previewUrl", "title", "videoId" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
CREATE UNIQUE INDEX "Track_title_artist_key" ON "Track"("title", "artist");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
