import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/* Prisma 7 은 드라이버 어댑터로 DB 에 붙는다. Postgres(Neon) — 주소는 .env 의 DATABASE_URL, 없으면 서버가 안 켜진다 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL 이 없다');
    // 연결 시간대는 UTC 로 고정 — DB 기본 시간대는 사람이 Neon 에서 볼 때 한국 시간이 되도록 Asia/Seoul 이다(10/3).
    // 시간 칸이 timestamptz 라 값 자체는 같지만, 날짜를 글자로 다루는 곳이 생겨도 UTC 기준이 흔들리지 않게
    super({ adapter: new PrismaPg({ connectionString: url, options: '-c TimeZone=UTC' }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
