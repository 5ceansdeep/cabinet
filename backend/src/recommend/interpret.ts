import { Injectable, Logger } from '@nestjs/common';
import { describeText, type Parts } from '../catalog/describe.js';
import { Gemini, MODELS } from '../catalog/gemini.js';

/* 요청문 → "이런 곡이면 좋겠다" 설명 + 목표 에너지·밝기 → 벡터 (docs/recommend-plan.md 6장).
   요청문을 바로 임베딩하지 않고 곡 설명과 같은 틀(감정/상황/가사/소리)로 풀어 쓴 뒤 임베딩한다 — 같은 말투끼리 비교해야 잘 맞는다.
   같은 문장이면 같은 결과: 온도 0 + 정규화한 문장으로 캐시.
   Gemini 대화 모델이 막히면(무료 한도) 요청문을 그대로 임베딩해 뜻만으로 — 임베딩 한도는 따로다.
   ponytail: 캐시는 메모리(최근 CACHE_MAX 문장) — 서버를 끄면 비고, 여러 대로 늘리면 DB 로 옮긴다 */

export type Asked = {
  keywords: string[]; // 화면 "요청 해석"
  tags?: string[]; // Last.fm 영어 태그 — 검색 기록(SearchLog)에 남겨 곡 풀 넓히기 씨앗으로
  description: string; // 풀어 쓴 설명 — 보고서에 곡 설명과 나란히
  vector: number[];
  energy: number | null; // 요청이 소리의 세기·밝기를 말할 때만
  valence: number | null;
};

const CACHE_MAX = 500;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    keywords: { type: 'ARRAY', items: { type: 'STRING' }, description: '요청을 어떻게 읽었는지 짧은 한국어 말 3~5개 (예: 퇴근길, 지친 하루, 위로)' },
    tags: { type: 'ARRAY', items: { type: 'STRING' }, description: '어울리는 곡에 붙을 법한 Last.fm 영어 태그 2~3개, 소문자 (예: melancholy, rainy day, driving)' },
    emotion: { type: 'STRING', description: '들려줄 곡이 주면 좋을 감정. 미묘한 결까지' },
    situation: { type: 'STRING', description: '이 사람이 있는 상황·때·장소' },
    lyrics: { type: 'STRING', description: '곡의 가사가 말하면 좋을 것 한두 문장' },
    sound: { type: 'STRING', description: '어울리는 소리의 느낌' },
    energy: { type: 'NUMBER', nullable: true, description: '0(조용한)~1(격한). 요청이 세기를 드러낼 때만, 아니면 null' },
    valence: { type: 'NUMBER', nullable: true, description: '0(슬픈·어두운)~1(밝은). 요청이 밝기를 드러낼 때만, 아니면 null' },
  },
  required: ['keywords', 'emotion', 'situation', 'lyrics', 'sound'],
};

export const promptFor = (query: string) =>
  [
    '음악 추천 서비스. 사용자가 적은 문장을 읽고, 이 사람에게 들려줄 곡이 어떤 곡이면 좋을지 곡 설명 틀로 쓴다.',
    '이 설명을 곡들의 설명(감정/상황/가사/소리)과 비교해 곡을 고른다. 각 항목을 한국어 한두 문장으로.',
    '음악과 상관없는 말("안녕하세요", "배고파")이어도 그 말을 하는 사람의 기분·상황을 짐작해 어울리는 곡을 쓴다.',
    '장르·가수·곡 이름은 쓰지 않는다. 사용자가 직접 말한 경우에만 소리 항목에 반영한다.',
    '',
    `사용자: ${query}`,
  ].join('\n');

const clamp = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : null);
export const normalize = (q: string) => q.trim().replace(/\s+/g, ' ').toLowerCase();

@Injectable()
export class Interpreter {
  private readonly log = new Logger('Interpret');
  private readonly cache = new Map<string, Asked>();

  constructor(private readonly gemini: Gemini) {}

  async interpret(query: string): Promise<Asked> {
    const key = normalize(query);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const asked = await this.fresh(key);
    this.cache.set(key, asked);
    if (this.cache.size > CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    return asked;
  }

  private async fresh(query: string): Promise<Asked> {
    try {
      const p = JSON.parse(await this.gemini.generate(MODELS.query, promptFor(query), SCHEMA)) as Parts & {
        keywords?: string[];
        energy?: number | null;
        valence?: number | null;
      };
      const description = describeText(p);
      return {
        tags?: string[];
        keywords: (p.keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 5),
        description,
        vector: await this.gemini.embed(description),
        energy: clamp(p.energy),
        valence: clamp(p.valence),
      };
        tags: (p.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 3),
    } catch (e) {
      // 대화 모델이 막혔다 — 요청문 그대로 (이것도 실패하면 위로 던진다)
      this.log.warn(`풀어 쓰기 실패, 요청문 그대로 임베딩: ${e}`);
      return { keywords: [], description: query, vector: await this.gemini.embed(query), energy: null, valence: null };
    }
  }
}
