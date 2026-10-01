import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Gemini, MODELS } from './gemini.js';
import { findLyrics, type Lyrics } from './lyrics.js';

/* 곡 설명 + 임베딩 — 추천의 "뜻" 재료 (docs/recommend-plan.md 5장). 곡당 한 번, 결과 영구 보관.
   가사(LRCLIB) + 제목·가수 + 소리 숫자를 Gemini 에 주고 정해진 틀(감정/상황/가사/소리)로 쓰게 한 뒤, 그 글을 임베딩한다.
   곡끼리 같은 틀이어야 벡터 비교가 공평하다. 매일 새벽 NIGHT_HOUR 시(소리 분석 뒤) + 관리자 POST /catalog/describe */

const NIGHT_HOUR = 6;
const GAP_MS = 6000; // 무료 한도(분당 호출 수)에 걸리지 않게
const LYRICS_MAX = 4000; // 글자 — 가사가 길어도 이만큼이면 주제는 드러난다

export type Parts = { emotion: string; situation: string; lyrics: string; sound: string };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    emotion: { type: 'STRING', description: '이 곡이 주는 감정. 미묘한 결까지 (예: 이별 뒤의 후련함, 약간의 씁쓸함)' },
    situation: { type: 'STRING', description: '어울리는 상황·때·장소 (예: 혼자 걷는 밤, 무언가를 정리하는 시기)' },
    lyrics: { type: 'STRING', description: '가사가 말하는 것 한두 문장. 가사를 인용하지 말고 풀어서. 소재가 분명하면(배고픔, 비, 운전) 그 낱말을 그대로 쓴다' },
    sound: { type: 'STRING', description: '소리의 느낌 (예: 잔잔하게 시작해 후렴에서 트인다)' },
  },
  required: ['emotion', 'situation', 'lyrics', 'sound'],
};

const level = (x: number) => (x < 0.33 ? '낮음' : x < 0.66 ? '중간' : '높음');

type Row = { id: string; title: string; artist: string; tags: string; energy: number | null; valence: number | null; acousticness: number | null };

export function promptFor(t: Row, lyrics: Lyrics) {
  const tags = Object.keys(JSON.parse(t.tags) as Record<string, number>).slice(0, 8);
  const sound =
    t.energy === null || t.valence === null
      ? '없음'
      : `에너지 ${t.energy.toFixed(2)}(${level(t.energy)}), 밝기 ${t.valence.toFixed(2)}(${level(t.valence)})` +
        (t.acousticness === null ? '' : `, 어쿠스틱 ${t.acousticness.toFixed(2)}`) +
        ' — 0~1, 30초 미리듣기(주로 후렴)를 분석한 값';
  return [
    '음악 추천 서비스의 곡 설명을 쓴다. 사용자가 자연어로 적은 상황·기분과 이 설명을 비교해 곡을 고른다.',
    '각 항목을 한국어 한두 문장으로. 장르 이름·가수 소개·발매 정보는 쓰지 않는다 — 어떤 기분·상황에 맞는 곡인지만.',
    '가사를 못 받았으면 제목과 소리로 조심스럽게 짐작하고, 모르는 것을 지어내지 않는다.',
    '',
    `곡: ${t.artist} - ${t.title}`,
    `소리 숫자: ${sound}`,
    tags.length ? `사람들이 붙인 태그(참고만): ${tags.join(', ')}` : '',
    lyrics?.text
      ? `가사:\n${lyrics.text.slice(0, LYRICS_MAX)}`
      : lyrics?.instrumental
        ? '가사: 없음 — 노래 없는 연주곡이다(가사 사이트 기록). 가사 항목에 연주곡이라고 쓴다'
        : '가사: 못 찾음 — 노래가 있는 곡일 수 있다. "연주곡"·"가사가 없는" 이라고 쓰지 않는다. 가사 항목은 제목에서 짐작되는 주제만 짧게',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/** 임베딩할 글이자 DB·화면에 남길 설명 */
export const describeText = (p: Parts) => `감정: ${p.emotion}\n상황: ${p.situation}\n가사: ${p.lyrics}\n소리: ${p.sound}`;

export type DescribeStatus = { running: boolean; done: number; noLyrics: number; failed: number; left: number };

@Injectable()
export class DescribeService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Describe');
  private status: DescribeStatus = { running: false, done: 0, noLyrics: 0, failed: 0, left: 0 };
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: Gemini,
  ) {}

  getStatus() {
    return this.status;
  }

  /** 설명이 없는 곡을 전부 — 뒤에서 돌고 바로 상태를 돌려준다 */
  start() {
    if (this.status.running) return this.status;
    this.status = { running: true, done: 0, noLyrics: 0, failed: 0, left: 0 };
    void this.run()
      .catch((e) => this.log.warn(`곡 설명 실패: ${e}`))
      .finally(() => (this.status.running = false));
    return this.status;
  }

  private async run() {
    const rows = await this.prisma.track.findMany({
      where: { describedAt: null },
      select: { id: true, title: true, artist: true, tags: true, energy: true, valence: true, acousticness: true },
      orderBy: { shelves: { _count: 'desc' } },
    });
    this.status.left = rows.length;
    let streak = 0; // 연달아 실패한 수
    for (const t of rows) {
      try {
        const lyrics = await findLyrics(t.title, t.artist);
        const parts = JSON.parse(await this.gemini.generate(MODELS.describe, promptFor(t, lyrics), SCHEMA)) as Parts;
        const description = describeText(parts);
        const embedding = await this.gemini.embed(description);
        await this.prisma.track.update({
          where: { id: t.id },
          data: { description, embedding: JSON.stringify(embedding), hasLyrics: !!lyrics?.text, instrumental: lyrics?.instrumental ?? null, describedAt: new Date() },
        });
        this.status.done++;
        if (!lyrics?.text) this.status.noLyrics++;
        streak = 0;
      } catch (e) {
        this.status.failed++; // 다음 배치가 다시 한다 — describedAt 을 안 찍었으니
        this.log.warn(`${t.artist} - ${t.title}: ${e}`);
        if (++streak >= 3) break; // 연달아 실패면 한도·키 문제 — 오늘은 그만
      }
      this.status.left--;
      await new Promise((ok) => setTimeout(ok, GAP_MS));
    }
    this.log.log(`곡 설명 끝 — ${this.status.done}곡(가사 없이 ${this.status.noLyrics}), 실패 ${this.status.failed}, 남음 ${this.status.left}`);
  }

  onModuleInit() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(NIGHT_HOUR, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    this.timer = setTimeout(() => {
      this.start();
      this.onModuleInit();
    }, next.getTime() - now.getTime());
  }

  onModuleDestroy() {
    clearTimeout(this.timer);
  }
}
