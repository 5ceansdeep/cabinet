-- 시간 칸을 "시간대 있는 시각"으로 — Neon·Prisma Studio 에서 한국 시간으로 보이게(10/3 사용자).
-- 지금 값은 UTC 로 저장돼 있으니 UTC 로 읽어 옮긴다(시각이 밀리지 않게).
ALTER TABLE "User" ALTER COLUMN "resetUntil" SET DATA TYPE TIMESTAMPTZ(3) USING "resetUntil" AT TIME ZONE 'UTC',
                   ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Shelf" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Track" ALTER COLUMN "checkedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "checkedAt" AT TIME ZONE 'UTC',
                    ALTER COLUMN "soundAt" SET DATA TYPE TIMESTAMPTZ(3) USING "soundAt" AT TIME ZONE 'UTC',
                    ALTER COLUMN "describedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "describedAt" AT TIME ZONE 'UTC';
ALTER TABLE "SearchLog" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "ThrowLog" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "EventLog" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- 사람이 SQL 로 볼 때의 기본 시간대 — 앱 연결은 prisma.service.ts 가 UTC 로 고정한다
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Asia/Seoul'); END $$;
