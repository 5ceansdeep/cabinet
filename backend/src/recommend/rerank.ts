import { Injectable, Logger } from '@nestjs/common';
import { Gemini, MODELS } from '../catalog/gemini.js';
import { normalize } from './interpret.js';

/* 2단계 고르기 — 1단계가 거른 후보들의 곡 설명을 Gemini 가 읽고 순위를 다시 매긴다 (docs/recommend-plan.md 3·6장).
   벡터로는 가깝지만 결이 다른 곡("후련한 이별" / "못 잊은 이별")을 가르는 게 목적. 같은 호출로 곡마다 한 줄 이유와
   신의 한마디(한국어 자막 + 영어 음성용 — docs/voice-persona.md)도 받는다.
   실패하면(한도·이상한 응답) 1단계 순서 그대로, 한마디 없이 — 추천이 멈추면 안 된다.
   ponytail: 캐시는 메모리(최근 CACHE_MAX) — 서버를 끄면 빈다 */

export type Line = { ko: string; en: string };
export type Reranked = { order: string[]; reasons: Record<string, string>; line: Line | null };
type Cand = { id: string; title: string; artist: string; description: string | null };

const CACHE_MAX = 300;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    order: { type: 'ARRAY', items: { type: 'INTEGER' }, description: '어울리는 순서대로 후보 번호. 어울리는 것만, 최대 6개' },
    reasons: {
      type: 'ARRAY',
      description: 'order 에 넣은 곡마다 왜 이 요청에 맞는지 한국어 한 문장(20자 안팎). 신의 말투(~네/~지/~게) — ~입니다·~해요 금지',
      items: { type: 'OBJECT', properties: { n: { type: 'INTEGER' }, why: { type: 'STRING' } }, required: ['n', 'why'] },
    },
    line_ko: { type: 'STRING', description: '신의 한마디 — 한국어 자막. 한두 문장, 40자 안팎' },
    line_en: { type: 'STRING', description: 'line_ko 와 같은 뜻의 영어 음성 대사. 한두 문장' },
  },
  required: ['order', 'reasons', 'line_ko', 'line_en'],
};

export function promptFor(query: string, want: string, cands: Cand[]) {
  return [
    '음악 추천 서비스 "신의 서류함". 사용자가 적은 문장에 맞는 곡을 후보 중에서 골라 순서를 매긴다.',
    '곡 설명의 감정·상황·가사를 요청과 비교해 결까지 맞는 곡을 앞에 둔다(예: "후련한 이별"에 "못 잊은 이별" 곡은 뒤로). 후보에 없는 곡은 만들지 않는다.',
    '',
    '그리고 곡을 건네며 하는 신의 한마디를 쓴다. 말투: 영화 <브루스 올마이티>의 신(모건 프리먼).',
    '자상하고 여유롭지만 권위와 드라이한 위트가 있다. 사용자를 "자네"라 부르고 ~네/~지/~게/~게나 로 끝낸다.',
    '짧고 군더더기 없이. 설명조·오글거림 금지. 곡 이름·가수 이름은 말하지 않는다 — 왜 이 곡들을 골랐는지 사용자의 마음을 짚어서.',
    '예: "헤어졌는데 후련해" → "끝난 걸 붙잡지 않는 자네가 기특하네. 가벼운 걸음에 맞는 곡들이지."',
    '영어 대사(line_en)는 같은 뜻을 여유롭고 위트 있는 구어체로 (casual, confident, warm, dry wit).',
    '',
    `사용자: ${query}`,
    `요청을 풀어 쓴 것:\n${want}`,
    '',
    '후보:',
    ...cands.map((c, i) => `${i + 1}. ${c.artist} - ${c.title}\n${c.description ?? '(설명 없음)'}`),
  ].join('\n');
}

type Raw = { order?: unknown; reasons?: { n?: unknown; why?: unknown }[]; line_ko?: unknown; line_en?: unknown };

/** Gemini 응답 → 후보 id 순서. 없는 번호·겹친 번호는 버리고, 빠진 후보는 1단계 순서대로 뒤에 붙인다 */
export function parse(raw: Raw, cands: Cand[]): Reranked {
  const pick = (n: unknown) => (Number.isInteger(n) && (n as number) >= 1 && (n as number) <= cands.length ? cands[(n as number) - 1].id : null);
  const order = [...new Set((Array.isArray(raw.order) ? raw.order : []).map(pick).filter((id): id is string => !!id))];
  const reasons: Record<string, string> = {};
  for (const r of raw.reasons ?? []) {
    const id = pick(r.n);
    if (id && typeof r.why === 'string' && r.why.trim()) reasons[id] = r.why.trim();
  }
  const ko = typeof raw.line_ko === 'string' ? raw.line_ko.trim() : '';
  const en = typeof raw.line_en === 'string' ? raw.line_en.trim() : '';
  return {
    order: [...order, ...cands.map((c) => c.id).filter((id) => !order.includes(id))],
    reasons,
    line: ko && en ? { ko, en } : null,
  };
}

@Injectable()
export class Reranker {
  private readonly log = new Logger('Rerank');
  private readonly cache = new Map<string, Reranked>();

  constructor(private readonly gemini: Gemini) {}

  async rerank(query: string, want: string, cands: Cand[]): Promise<Reranked> {
    const key = `${normalize(query)}\u0000${cands.map((c) => c.id).join(',')}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    try {
      const raw = JSON.parse(await this.gemini.generate(MODELS.rerank, promptFor(query, want, cands), SCHEMA)) as Raw;
      const out = parse(raw, cands);
      this.cache.set(key, out);
      if (this.cache.size > CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
      return out;
    } catch (e) {
      this.log.warn(`재정렬 실패, 1단계 순서 그대로: ${e}`);
      return { order: cands.map((c) => c.id), reasons: {}, line: null };
    }
  }
}
