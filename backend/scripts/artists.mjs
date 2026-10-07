/* 가수의 다른 표기(한글 ↔ 로마자)를 Track.artistAlt 에 채운다 — 곡 풀은 "엔시티 드림", 사용자는 "NCT" 라고 써도 찾게(10/7).
   새로 모으는 곡은 수집할 때 채워진다(itunes.ts). 이건 그전에 들어온 곡용 — MusicBrainz(무료, 초당 1회), Gemini 안 씀.
   nest build 뒤에:
   node scripts/artists.mjs find [N]  읽기만. artistAlt 가 빈 가수(N 명까지, 없으면 전부)의 다른 표기를 찾아 backend/.artists.json 에 쓰고 찍는다
   node scripts/artists.mjs apply     .artists.json 에서 alt 가 있는 가수의 곡에 채운다(이미 채워진 곡은 그대로) */
import { readFileSync, writeFileSync } from 'node:fs';
import { setDefaultResultOrder } from 'node:dns';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { otherName } from '../dist/catalog/musicbrainz.js';

setDefaultResultOrder('ipv4first');
process.loadEnvFile(new URL('../.env', import.meta.url));
const FOUND = new URL('../.artists.json', import.meta.url);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.argv[2] === 'find') {
  const rows = await prisma.track.groupBy({ by: ['artist'], where: { artistAlt: null }, _count: true, orderBy: { _count: { artist: 'desc' } } });
  const out = [];
  for (const r of rows.slice(0, Number(process.argv[3]) || rows.length)) {
    const alt = await otherName(r.artist);
    console.log(`${r.artist} (${r._count}곡)  →  ${alt ?? '-'}`);
    out.push({ artist: r.artist, alt });
  }
  writeFileSync(FOUND, JSON.stringify(out, null, 1));
  console.log(`${out.length}명 중 ${out.filter((o) => o.alt).length}명 찾음`);
} else if (process.argv[2] === 'apply') {
  let n = 0;
  for (const o of JSON.parse(readFileSync(FOUND, 'utf8')).filter((x) => x.alt))
    n += (await prisma.track.updateMany({ where: { artist: o.artist, artistAlt: null }, data: { artistAlt: o.alt } })).count;
  console.log(`${n}곡 채움`);
} else console.log('node scripts/artists.mjs find [N] | apply');
await prisma.$disconnect();
