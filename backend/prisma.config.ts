import { defineConfig, env } from "prisma/config";

// Prisma 7 은 .env 를 자동으로 읽지 않는다 — 노드가 직접 읽어 준다
process.loadEnvFile(".env");

/* 스키마 경로와 DB 주소는 여기서 읽는다 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: env("DATABASE_URL") },
});
