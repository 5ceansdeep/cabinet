import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { Gemini, MODELS } from './gemini.js';
import { findLyrics, type Lyrics } from './lyrics.js';
// 곡 사이 쉬는 시간 — Gemini 는 유료(10/1)라 분당 한도가 넉넉하지만, 가사를 못 찾으면 iTunes(분당 20회 남짓)로 영문 이름을 찾는다
import { GAP_MS } from './pool.js';

/* 곡 설명 + 임베딩 — 추천의 "뜻" 재료 (docs/recommend-plan.md 5장). 곡당 한 번, 결과 영구 보관.
   가사(LRCLIB) + 제목·가수 + 소리 숫자를 Gemini 에 주고 정해진 틀(감정/상황/가사/소리)로 쓰게 한 뒤, 그 글을 임베딩한다.
   곡끼리 같은 틀이어야 벡터 비교가 공평하다. 매일 새벽 NIGHT_HOUR 시(소리 분석 뒤) + 관리자 POST /catalog/describe */

const NIGHT_HOUR = 6;
const LYRICS_MAX = 4000; // 글자 — 가사가 길어도 이만큼이면 주제는 드러난다

export type Parts = { emotion: string; situation: string; lyrics: string; sound: string };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    emotion: {
      type: 'STRING',
      description: '[핵심어 3개] + 감정선 한두 문장. 예: "[이별, 미련, 섭섭함] 연애가 끝난 뒤 섭섭하고 억울하지만 새침하게 털어내려는 마음이다."',
    },
    situation: {
      type: 'STRING',
      description: '[핵심어 3개] + 어울리는 때·장소 한두 문장. 예: "[이별 후, 혼자 있을 때, 마음 정리] 작은 다정함을 바랐다 돌아선 뒤 혼자 마음을 추스를 때 어울린다."',
    },
    lyrics: {
      type: 'STRING',
      description: '[핵심어 2~3개] + 가사의 주제 한두 문장(인용 말고 풀어서). 소재가 분명하면(배고픔, 비, 운전) 그 낱말을 핵심어에. 예: "[이별, 소박한 사랑, 밤양갱] 대단한 대접이 아니라 작고 달콤한 애정 한 조각을 바랐던 마음을 털어놓는다."',
    },
    sound: {
      type: 'STRING',
      description: '[핵심어 3개] + 소리 한두 문장. 예: "[경쾌함, 어쿠스틱, 처연함] 사뿐사뿐 굴러가는 건반 위로 조곤조곤 이어지는 노래가 경쾌하면서도 은근히 처연하다."',
    },
  },
  required: ['emotion', 'situation', 'lyrics', 'sound'],
};

const level = (x: number) => (x < 0.33 ? '낮음' : x < 0.66 ? '중간' : '높음');

type Row = {
  id: string;
  title: string;
  artist: string;
  tags: string;
  energy: number | null;
  valence: number | null;
  acousticness: number | null;
  danceability: number | null;
  tempo: number | null;
};

/* 핵심어 + 묘사 (10/1 두 번째). 구체적인 서사만 쓰게 했더니(첫 번째) 곡 벡터가 감정 쪽에서 소재·행동 쪽으로 끌려가
   감정·상황 요청 재현율이 42% → 28% 로 떨어졌다(같은 243곡). 칸마다 사람들이 검색에 쓰는 표준 핵심어를 앞에 두어
   감정 요청은 핵심어로, 소재 요청은 묘사로 붙게 한다. 가사 없는 곡은 생활 장면을 지어내 엉뚱한 요청("배고파")에 끼어들었다 */
const EXAMPLE = [
  '예(지어낸 곡 "라면 두 개" — 문장을 베끼지 말고 형식만 참고한다):',
  '  감정: [이별, 쓸쓸함, 담담함] 혼자가 된 게 실감 나는 순간의 멋쩍은 쓸쓸함 속에서도 피식 웃게 되는 담담함이다.',
  '  상황: [이별 후, 혼자 있을 때, 늦은 밤] 습관처럼 라면을 두 개 끓였다가 하나를 덜어 낼 때 어울린다.',
  '  가사: [이별, 습관, 라면] 둘이 나눠 먹던 야식 습관이 남아 있다는 걸 음식에 빗대어 털어놓는다.',
  '  소리: [잔잔함, 어쿠스틱, 담백함] 통기타 한 대와 말하듯 부르는 보컬이 후렴에서도 크게 터지지 않는다.',
].join('\n');

export function promptFor(t: Row, lyrics: Lyrics) {
  const tags = Object.keys(JSON.parse(t.tags) as Record<string, number>).slice(0, 8);
  const nums = [
    t.energy !== null && `에너지 ${t.energy.toFixed(2)}(${level(t.energy)})`,
    t.valence !== null && `밝기 ${t.valence.toFixed(2)}(${level(t.valence)})`,
    t.danceability !== null && `춤추기 좋음 ${t.danceability.toFixed(2)}(${level(t.danceability)})`,
    t.acousticness !== null && `어쿠스틱 ${t.acousticness.toFixed(2)}(${level(t.acousticness)})`,
    t.tempo !== null && `빠르기 ${Math.round(t.tempo)} BPM`,
  ].filter(Boolean);
  const sound = nums.length ? `${nums.join(', ')} — 0~1, 30초 미리듣기(주로 후렴)를 분석한 값` : '없음';
  return [
    '음악 추천 서비스의 곡 설명을 쓴다. 사용자가 자연어로 적은 상황·기분·소재와 이 설명을 비교해 곡을 고른다.',
    '각 항목은 대괄호 핵심어로 시작하고, 이어서 한국어 한두 문장. 끝은 "~다".',
    '핵심어는 사람들이 검색에 쓰는 흔한 말로 — 감정(이별·미련·그리움·짝사랑·설렘·사랑·외로움·슬픔·위로·후련함·자신감·신남·평온·불안·지침 등),',
    '상황(출근길·퇴근길·드라이브·운동·공부·휴식·새벽·여행·연인과 함께·친구들과·혼자 있을 때 등), 소리(잔잔함·경쾌함·신남·강렬함·몽환적·어쿠스틱·전자음 등).',
    '묘사는 이 곡만의 결을 구체적으로 쓰되, 핵심어의 감정과 어긋나지 않게. 장르 이름·가수 소개·발매 정보는 쓰지 않는다.',
    '가사를 못 받은 곡은 생활 장면(밥·음식·전화·눈물 같은 행동이나 사건)을 지어내지 않는다 — 상황은 듣는 환경(공부·휴식·카페·드라이브·작업·잠들기 전)만.',
    '',
    EXAMPLE,
    '',
    `곡: ${t.artist} - ${t.title}`,
    `소리 숫자: ${sound}`,
    tags.length ? `사람들이 붙인 태그(참고만): ${tags.join(', ')}` : '',
    lyrics?.text
      ? `가사:\n${lyrics.text.slice(0, LYRICS_MAX)}`
      : lyrics?.instrumental
        ? '가사: 없음 — 노래 없는 연주곡이다(가사 사이트 기록). 가사 항목은 "[가사 없음, 연주곡] 노래 없이 악기로만 흐르는 곡이다."'
        : '가사: 못 찾음 — 노래가 있는 곡일 수 있다. "연주곡"이라고 쓰지 않는다. 가사 항목은 "[가사 모름] 가사 정보가 없다."',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/** 임베딩할 글이자 DB·화면에 남길 설명 */
export const describeText = (p: Parts) => `감정: ${p.emotion}\n상황: ${p.situation}\n가사: ${p.lyrics}\n소리: ${p.sound}`;

export type DescribeStatus = { running: boolean; done: number; noLyrics: number; failed: number; left: number; stopped?: string }; // stopped = 도중에 멈춘 까닭

/** 선불 크레딧이 바닥났나(402) — 다시 불러도 같고, 추천도 같은 크레딧을 쓴다 */
export const outOfCredit = (e: unknown) => / 402 /.test(String(e)); // Gemini.call 의 오류 글은 "모델 상태코드 본문"

@Injectable()
export class DescribeService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Describe');
  private status: DescribeStatus = { running: false, done: 0, noLyrics: 0, failed: 0, left: 0 };
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: Gemini,
    private readonly config: ConfigService,
  ) {}

  getStatus() {
    return this.status;
  }

  /** 설명이 없는 곡을 limit 곡까지(안 주면 전부) — 뒤에서 돌고 바로 상태를 돌려준다.
      10/6: 한 번에 전부 돌리다 선불 크레딧이 바닥나 추천까지 멈췄다 — 나눠 돌릴 수 있게 */
  start(limit?: number) {
    if (this.status.running) return this.status;
    this.status = { running: true, done: 0, noLyrics: 0, failed: 0, left: 0 };
    void this.run(limit)
      .catch((e) => this.log.warn(`곡 설명 실패: ${e}`))
      .finally(() => (this.status.running = false));
    return this.status;
  }

  private async run(limit?: number) {
    const rows = await this.prisma.track.findMany({
      where: { describedAt: null },
      select: { id: true, title: true, artist: true, tags: true, energy: true, valence: true, acousticness: true, danceability: true, tempo: true },
      orderBy: { shelves: { _count: 'desc' } },
      take: limit,
    });
    await this.describeRows(rows);
  }

  /** missingArtist·missingSong 으로 방금 담은 곡만 콕 집어 설명 — 밀린 설명(describedAt: null 전체)은 안 건드린다(10/7 사용자).
      이미 큰 배치가 돌고 있으면 건너뛴다(겹쳐 돌리지 않는다) */
  async describeIds(ids: string[]) {
    if (!ids.length || this.status.running) return;
    const rows = await this.prisma.track.findMany({
      where: { id: { in: ids }, describedAt: null },
      select: { id: true, title: true, artist: true, tags: true, energy: true, valence: true, acousticness: true, danceability: true, tempo: true },
    });
    if (!rows.length) return;
    this.status = { running: true, done: 0, noLyrics: 0, failed: 0, left: rows.length };
    try {
      await this.describeRows(rows);
    } finally {
      this.status.running = false;
    }
  }

  private async describeRows(rows: Row[]) {
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
        if (outOfCredit(e)) {
          this.status.stopped = 'Gemini 선불 크레딧 없음 — 충전 뒤 다시';
          break; // 세 번 채울 것 없이 바로 — 남은 곡도 전부 같은 답이다
        }
        if (++streak >= 3) break; // 연달아 실패면 한도·키 문제 — 오늘은 그만
      }
      this.status.left--;
      await new Promise((ok) => setTimeout(ok, GAP_MS));
    }
    this.log.log(`곡 설명 끝 — ${this.status.done}곡(가사 없이 ${this.status.noLyrics}), 실패 ${this.status.failed}, 남음 ${this.status.left}`);
  }


  // 새벽 자동 실행은 DESCRIBE_NIGHTLY=true 일 때만 — 10/2 사용자: 곡을 먼저 잔뜩 모으고 Gemini(돈 드는 설명)는 나중에 한 번에 붙인다.
  // 꺼져 있으면 설명 없는 곡은 추천에 안 나온다. 붙일 땐 POST /catalog/describe 또는 이 값을 켠다
  onModuleInit() {
    if (this.config.get('DESCRIBE_NIGHTLY') !== 'true') return;
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
