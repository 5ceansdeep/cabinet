import { setDefaultResultOrder } from 'node:dns';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { type Asked, Interpreter } from './interpret.js';
import { RecommendService } from './recommend.js';
import { A, rank } from './score.js';

/* 추천 평가 — `npm run eval`. eval.json 의 요청마다 상위 5곡에 나와야 할 곡이 몇 개 들었나.
   A(뜻 비중)를 바꿔 가며 같은 해석으로 다시 잰다 — 해석은 .eval-cache.json 에 남겨 Gemini 한도를 다시 쓰지 않는다.
   Gemini 가 막혀 요청문 그대로 쓴 해석(해석어 없음)은 캐시하지 않는다 — 내일 다시 */

setDefaultResultOrder('ipv4first');
const TOP = 5;
const AS = [0.4, 0.5, 0.6, 0.7, 0.8, 1];
const CACHE = '.eval-cache.json';

type Case = { q: string; want: string[]; pair?: string };
const { cases } = JSON.parse(readFileSync('src/recommend/eval.json', 'utf8')) as { cases: Case[] };

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
try {
  const pool = await app.get(RecommendService).loadPool();
  const name = (t: { artist: string; title: string }) => `${t.artist} - ${t.title}`;
  const names = new Set(pool.map(name));
  const missing = cases.flatMap((c) => c.want.filter((w) => !names.has(w)));
  if (missing.length) console.warn(`곡 풀에 없는 곡 (오타?) — ${missing.join(' / ')}`);

  const cache = (existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}) as Record<string, Asked>;
  const interpreter = app.get(Interpreter);
  for (const c of cases) {
    if (cache[c.q]) continue;
    const asked = await interpreter.interpret(c.q);
    if (asked.keywords.length) cache[c.q] = asked;
    else console.warn(`해석 실패(한도?) — 뺌: ${c.q}`);
  }
  writeFileSync(CACHE, JSON.stringify(cache));

  const run = (a: number, center = true) =>
    cases
      .filter((c) => cache[c.q])
      .map((c) => {
        const top = rank(pool, cache[c.q], { a, center }).slice(0, TOP).map(name);
        const hits = c.want.filter((w) => top.includes(w)).length;
        return { c, top, hits, recall: hits / Math.min(TOP, c.want.length) };
      });

  console.log(`\n요청 ${Object.keys(cache).length}/${cases.length}개, 곡 ${pool.length}곡, 상위 ${TOP}곡 기준\n`);
  console.log('A(뜻 비중)  평균 빼기  하나라도 맞음  평균 재현율');
  for (const center of [false, true])
    for (const a of AS) {
      const r = run(a, center);
      const hit = r.filter((x) => x.hits > 0).length;
      const recall = r.reduce((s, x) => s + x.recall, 0) / (r.length || 1);
      console.log(`  ${a.toFixed(1)}        ${center ? '예 ' : '아니'}      ${hit}/${r.length}           ${(recall * 100).toFixed(0)}%`);
    }

  const a = Number(process.argv[2] ?? A);
  console.log(`\n── 요청별 (A = ${a}) ──`);
  for (const { c, top, hits } of run(a)) {
    console.log(`\n${hits ? '○' : '✗'} ${c.q}${c.pair ? ` [${c.pair}]` : ''}  해석: ${cache[c.q].keywords.join(' · ')}  (${hits}/${Math.min(TOP, c.want.length)})`);
    for (const t of top) console.log(`   ${c.want.includes(t) ? '✓' : ' '} ${t}`);
  }
} finally {
  await app.close();
}
