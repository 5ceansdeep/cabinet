import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PT } from './youtube.js';

/* Gemini API — 곡 설명·요청 풀어 쓰기(대화 모델)와 임베딩. 외부 LLM 호출은 전부 여기로 모은다 (회사를 바꾸면 이 파일만).
   무료 한도(9/30): Pro 계열은 0, Flash 계열만 된다. Flash 는 "사람 몰림(503)"이 잦아 모델 목록을 돌아가며 다시 부른다.
   ponytail: 무료 한도에선 보낸 글이 Google 모델 개선에 쓰일 수 있다 — 실제 사용자에게 열기 전에 유료로 바꾼다 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const MODELS = {
  describe: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'], // 곡당 한 번 — 좋은 것부터
  query: ['gemini-3.5-flash-lite', 'gemini-3.8-flash'], // 요청 풀어 쓰기 — 요청마다, 빠른 것부터
  rerank: ['gemini-3.5-flash-lite', 'gemini-3.8-flash'], // 2단계 고르기 + 신의 한마디 — 요청마다라 하루 한도가 큰 Lite(500) 부터. 3.8-flash 는 하루 20번
  embed: 'gemini-embedding-2',
};
export const DIM = 768; // 3072 중 앞 768 — 곡 수천 개를 JSON 으로 들고 다녀도 가볍게. 바꾸면 곡 벡터를 전부 다시 만든다
const TRIES = 5;

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: PT }); // 무료 한도는 태평양 자정에 풀린다

/** 429 응답의 "Please retry in 54s" / retryDelay "54s" */
export function retryAfter(message: string): number | null {
  const m = /retry(?:Delay"?:\s*"| in )(\d+(?:\.\d+)?)s/i.exec(message);
  return m ? Math.ceil(Number(m[1]) * 1000) : null;
}

/** 길이 1 로 — 3072 보다 작게 자르면 Gemini 는 정규화해 주지 않는다 */
export const unit = (v: number[]) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

@Injectable()
export class Gemini {
  private readonly log = new Logger('Gemini');
  private readonly key: string;

  constructor(config: ConfigService) {
    this.key = config.getOrThrow<string>('GEMINI_API_KEY'); // 없으면 서버가 켜지지 않는다
  }

  // 오늘(태평양 날짜) 하루 한도를 다 쓴 모델 → 그 날짜. 무료 한도는 모델마다 따로다(3.8-flash 는 하루 20번)
  private readonly spent = new Map<string, string>();
  private live = (models: string[]) => models.filter((m) => this.spent.get(m) !== today());

  /** 모델을 돌아가며 — 503·500·연결 실패는 다음 모델로, 하루 한도면 그 모델을 오늘 빼고, 분당 한도면 알려 준 만큼 기다렸다가 */
  private async call<T>(models: string[], method: string, body: unknown): Promise<T> {
    let last = '';
    for (let i = 0; i < TRIES; i++) {
      const pool = this.live(models);
      if (!pool.length) break;
      const model = pool[i % pool.length];
      try {
        const res = await fetch(`${BASE}/${model}:${method}`, {
          method: 'POST',
          headers: { 'x-goog-api-key': this.key, 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(90000),
        });
        if (res.ok) return (await res.json()) as T;
        const text = await res.text();
        last = `${model} ${res.status} ${text.slice(0, 300)}`;
        if (res.status === 429) {
          if (/PerDay/.test(text)) {
            this.spent.set(model, today());
            this.log.warn(`${model} 오늘 한도 다 씀 — 다른 모델로`);
            continue;
          }
          await sleep(Math.min(retryAfter(text) ?? 30000, 65000));
          continue;
        }
        if (res.status < 500) break; // 요청이 틀렸다 — 다시 불러도 같다
      } catch (e) {
        last = `${model} ${String((e as Error).cause ?? e)}`; // 망 흔들림(회사망에서 가끔 연결 시간 초과)
      }
      await sleep(2000 * (i + 1));
    }
    if (!this.live(models).length) last = `오늘 한도 다 씀 (${models.join(', ')})`;
    this.log.warn(`실패: ${last}`);
    throw new Error(`Gemini 실패 — ${last}`);
  }

  /** 글 → 글. schema 를 주면 그 모양의 JSON 문자열로 받는다 */
  async generate(models: string[], prompt: string, schema?: object): Promise<string> {
    const json = await this.call<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>(models, 'generateContent', {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, ...(schema && { responseMimeType: 'application/json', responseSchema: schema }) },
    });
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error('Gemini 빈 응답');
    return text;
  }

  /** 글 → 벡터(길이 1, DIM 차원) */
  async embed(text: string): Promise<number[]> {
    const json = await this.call<{ embedding?: { values?: number[] } }>([MODELS.embed], 'embedContent', {
      content: { parts: [{ text }] },
      outputDimensionality: DIM,
      taskType: 'SEMANTIC_SIMILARITY',
    });
    const v = json.embedding?.values;
    if (!v?.length) throw new Error('Gemini 빈 임베딩');
    return unit(v);
  }
}
