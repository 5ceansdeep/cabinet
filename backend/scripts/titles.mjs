/* 영어 제목으로 들어간 한국 곡 → 한국 스토어의 한글 제목으로(10/7 베타: "항해"가 "Beautiful Sailing"으로 나왔다).
   한국 iTunes 스토어가 0건을 주는 망(회사 PC)에선 못 돌린다 — 절차는 docs/other-pc.md.
   node scripts/titles.mjs find   읽기만. 후보를 backend/.titles.json 에 쓰고 화면에 찍는다(곡당 3초 — iTunes 분당 20회)
   node scripts/titles.mjs apply  .titles.json 의 후보(ko 가 있는 줄)로 Track.title 을 바꾸고, 평가 정답표(eval.json)의 "가수 - 제목"도 같이 바꾼다
   같은 곡인지는 곡 번호로 — 한국 스토어 곡을 미국 스토어에서 조회해 영어 제목이 우리 제목과 같을 때만 후보로 친다 */
import { readFileSync, writeFileSync } from 'node:fs';
import { setDefaultResultOrder } from 'node:dns';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

setDefaultResultOrder('ipv4first');
process.loadEnvFile(new URL('../.env', import.meta.url));
const FOUND = new URL('../.titles.json', import.meta.url);
const EVAL = new URL('../src/recommend/eval.json', import.meta.url);
const HANGUL = /[가-힣]/;
const norm = (s) => s.toLowerCase().replace(/[\s()[\]{}'"‘’“”.,!?&:;/\\_-]+/g, '');
const json = async (url) => {
  try {
    return (await (await fetch(url, { signal: AbortSignal.timeout(15000) })).json()).results ?? [];
  } catch {
    return [];
  }
};
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.argv[2] === 'find') {
  const all = await prisma.track.findMany({ select: { id: true, title: true, artist: true } });
  const targets = all.filter((t) => HANGUL.test(t.artist) && !HANGUL.test(t.title));
  console.log(`한글 가수 + 영어 제목: ${targets.length}곡`);
  const out = [];
  for (const t of targets) {
    const rs = await json(`https://itunes.apple.com/search?${new URLSearchParams({ media: 'music', entity: 'song', limit: '10', country: 'kr', term: `${t.artist} ${t.title}` })}`);
    const ko = rs.filter((r) => HANGUL.test(r.trackName));
    const us = ko.length ? await json(`https://itunes.apple.com/lookup?id=${ko.map((r) => r.trackId).join(',')}&country=us`) : [];
    const match = us.find((u) => u.trackName && norm(u.trackName) === norm(t.title));
    const hit = match ? ko.find((r) => r.trackId === match.trackId) : null;
    console.log(`${t.artist} - ${t.title}  →  ${hit ? hit.trackName : rs.length ? '(한글 제목 없음)' : '(0건)'}`);
    out.push({ id: t.id, artist: t.artist, title: t.title, ko: hit?.trackName ?? null, n: rs.length });
    await new Promise((ok) => setTimeout(ok, 3100));
  }
  writeFileSync(FOUND, JSON.stringify(out, null, 1));
  const zero = out.filter((o) => !o.n).length;
  console.log(`후보 ${out.filter((o) => o.ko).length}곡 · 0건 ${zero}곡${zero > out.length / 2 ? ' — 0건이 절반을 넘는다. 이 망도 한국 스토어가 막힌 것 같다' : ''}`);
} else if (process.argv[2] === 'apply') {
  const found = JSON.parse(readFileSync(FOUND, 'utf8')).filter((o) => o.ko);
  let evalText = readFileSync(EVAL, 'utf8');
  let done = 0;
  for (const o of found) {
    try {
      // 그사이 제목이 바뀐 곡은 건드리지 않는다. 같은 한글 제목 곡이 이미 있으면(@@unique) 실패 — 건너뛴다
      const r = await prisma.track.updateMany({ where: { id: o.id, title: o.title }, data: { title: o.ko } });
      if (!r.count) continue;
      done++;
      evalText = evalText.replaceAll(JSON.stringify(`${o.artist} - ${o.title}`), JSON.stringify(`${o.artist} - ${o.ko}`));
    } catch {
      console.log(`건너뜀(같은 제목 곡이 이미 있다): ${o.artist} - ${o.ko}`);
    }
  }
  writeFileSync(EVAL, evalText);
  console.log(`${done}곡 바꿈`);
} else console.log('node scripts/titles.mjs find | apply');
await prisma.$disconnect();
