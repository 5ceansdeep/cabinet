import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// Prisma 7 은 .env 를 자동으로 읽지 않는다 — 노드가 직접 읽어 준다.
// 파일이 있을 때만: 배포 서버는 .env 파일 없이 환경변수로 값을 넣어 주므로, 무조건 읽으면 빌드가 "파일 없음"으로 죽는다
if (existsSync(".env")) process.loadEnvFile(".env");

/* 스키마 경로와 DB 주소는 여기서 읽는다 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: env("DATABASE_URL") },
});
