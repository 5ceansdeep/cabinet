-- 편지별 기록 — 그 편지에 꺼내 준 곡을 전부(부칠 때마다 뒤에 붙는다)
ALTER TABLE "LetterLine" ADD COLUMN "tracks" TEXT NOT NULL DEFAULT '[]';
