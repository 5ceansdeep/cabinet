import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/* 소리 숫자 — iTunes 30초 미리듣기를 ReccoBeats 에 올려 energy·valence 등을 받는다 (docs/recommend-plan.md 3장).
   키 없는 비공식 무료 서비스라 한도를 모른다 → 곡당 한 번만, 결과는 영구 보관. 사용자 요청 중엔 부르지 않는다.
   매일 새벽 NIGHT_HOUR 시(곡 풀 넓히기 뒤)에 숫자가 없는 곡만, 관리자는 POST /catalog/sound 로 바로.
   ponytail: 미리듣기는 보통 후렴 30초라 조용히 시작해 터지는 곡은 세게 나온다 — 전곡 분석은 원본 파일이 없어 못 한다 */

const API = 'https://api.reccobeats.com/v1/analysis/audio-features';
const GAP_MS = 1500; // 한도를 몰라 천천히
const NIGHT_HOUR = 5; // 곡 풀 넓히기(4시)가 담은 곡까지

export type Sound = { energy: number; valence: number; danceability: number; acousticness: number; tempo: number };
const KEYS = ['energy', 'valence', 'danceability', 'acousticness', 'tempo'] as const;

/** 응답에서 쓸 숫자만 — 하나라도 빠지면 null */
export function parseSound(json: unknown): Sound | null {
  const o = json as Record<string, unknown>;
  if (!o || !KEYS.every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]))) return null;
  return Object.fromEntries(KEYS.map((k) => [k, o[k]])) as Sound;
}

/** 미리듣기 하나 분석. 'bad' = 이 파일은 안 됨(다시 안 올림), 'stop' = 서비스 쪽 문제(오늘은 그만) */
async function analyze(previewUrl: string): Promise<Sound | 'bad' | 'stop'> {
  try {
    const audio = await fetch(previewUrl, { signal: AbortSignal.timeout(20000) });
    if (!audio.ok) return 'bad';
    const form = new FormData();
    form.append('audioFile', await audio.blob(), 'preview.m4a');
    const res = await fetch(API, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
    if (res.status === 429 || res.status >= 500) return 'stop';
    if (!res.ok) return 'bad';
    return parseSound(await res.json()) ?? 'bad';
  } catch {
    return 'stop'; // 연결 실패·시간 초과
  }
}

export type SoundStatus = { running: boolean; done: number; bad: number; left: number; stopped: boolean };

@Injectable()
export class SoundService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Sound');
  private status: SoundStatus = { running: false, done: 0, bad: 0, left: 0, stopped: false };
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return this.status;
  }

  /** 숫자가 없는 곡을 전부 — 뒤에서 돌고 바로 상태를 돌려준다 */
  start() {
    if (this.status.running) return this.status;
    this.status = { running: true, done: 0, bad: 0, left: 0, stopped: false };
    void this.run()
      .catch((e) => this.log.warn(`소리 분석 실패: ${e}`))
      .finally(() => (this.status.running = false));
    return this.status;
  }

  private async run() {
    const rows = await this.prisma.track.findMany({
      where: { soundAt: null, previewUrl: { not: null } },
      select: { id: true, previewUrl: true },
      orderBy: { shelves: { _count: 'desc' } },
    });
    this.status.left = rows.length;
    for (const t of rows) {
      const r = await analyze(t.previewUrl!);
      if (r === 'stop') {
        this.status.stopped = true;
        break;
      }
      await this.prisma.track.update({ where: { id: t.id }, data: r === 'bad' ? { soundAt: new Date() } : { ...r, soundAt: new Date() } });
      if (r === 'bad') this.status.bad++;
      else this.status.done++;
      this.status.left--;
      await new Promise((ok) => setTimeout(ok, GAP_MS));
    }
    this.log.log(`소리 분석 끝 — ${this.status.done}곡 채움, ${this.status.bad}곡 안 됨, ${this.status.left}곡 남음${this.status.stopped ? ' (서비스 응답 없어 멈춤)' : ''}`);
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
