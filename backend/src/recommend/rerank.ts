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
    order: { type: 'ARRAY', items: { type: 'INTEGER' }, description: '가장 어울리는 것부터 후보 번호 10개(후보가 10곡보다 적으면 전부). 이 순서대로 화면에 보여 준다' },
    // 곡별 이유(reasons)는 10/1 뺐다 — 화면에서 안 쓰고, 10문장을 더 쓰느라 응답이 늦었다. parse 는 와도 받는다
    line_ko: { type: 'STRING', description: '신의 한마디 — 한국어 자막. 한두 문장, 40자 안팎' },
    line_en: { type: 'STRING', description: 'line_ko 와 같은 뜻의 영어 음성 대사. line_ko 와 문장 수가 같게 — 음성의 문장 쉼에 맞춰 한국어 자막 줄을 넘긴다' },
  },
  required: ['order', 'line_ko', 'line_en'],
};

export function promptFor(query: string, want: string, cands: Cand[]) {
  return [
    '음악 추천 서비스 "신의 서류함". 사용자가 적은 문장에 맞는 곡을 후보 중에서 골라 순서를 매긴다.',
    '곡 설명의 감정·상황·가사를 요청과 비교해 결까지 맞는 곡을 앞에 둔다(예: "후련한 이별"에 "못 잊은 이별" 곡은 뒤로). 후보에 없는 곡은 만들지 않는다.',
    '',
    '그리고 곡을 건네며 하는 한마디를 쓴다. 말하는 이: 영화 <브루스 올마이티>의 신(모건 프리먼)이지만 정체를 드러내지 않는다 — 이 서류함을 오래 지켜 온, 수상하게 다 아는 관리인처럼.',
    '신·세상을 만들었다·창조·기적·천국·기도·영원·일곱째 날처럼 정체를 밝히는 말은 쓰지 않는다. 권능은 드러내지 않는다 — 이 일을 아주 오래 해 온 사람의 능청으로만 비친다.',
    // 10/6 사용자: 재미없고 고리타분하다 — 지친 편지마다 "고생 많았네 … 들어가게" 로 토닥였고, 예시부터 위로로 끝났다. 위로 금지.
    // 같은 날 "사소한 사실을 딱 집어 아는 척"을 시켜 봤더니 "신발장 슬리퍼 왼쪽만 닳았더군" 처럼 뜬금없고 훔쳐본 것 같았다 — 구체적인 참견도 금지(사용자)
    '능청스럽고 여유롭다. 드라이한 위트가 전부다. 사용자를 "자네"라 부르고 주로 ~네/~지/~거든 으로 끝낸다. 문장마다 어미를 다르게.',
    '~군·~더군은 한 마디에 한 번까지. ~게나·~구먼·~세나·~느니라 같은 옛말 어미, "너/네가" 반말 호칭은 쓰지 않는다.',
    '연극 대사·번역투가 아니라 사람이 무심하게 툭 던지는 말처럼 — 한국어 자막으로 읽어도 오글거리지 않게.',
    '곡을 소개하지 않는다. 노래는 이미 건넸으니 사용자의 말에 사람처럼 반응만 한다 — 무심한 핀잔, 말꼬리 잡기, 엉뚱한 쪽으로 받아치기, 능청스러운 딴소리 중 이 상황에 제일 웃긴 것 하나.',
    '웃기는 법: 사용자가 쓴 말 자체를 살짝 비튼다. 큰일은 별일 아닌 듯, 별일 아닌 건 큰일인 듯 받는다. 말은 짧고 표정은 없다.',
    '위로·격려·걱정을 하지 않는다: "고생 많았네", "힘내게", "푹 쉬게", "자네 탓이 아니네", "눈에 선하네" 금지.',
    '참견·훈수도 하지 않는다: "~해 보게", "~하게", "~부터 챙기게" 처럼 시키는 말로 끝내지 않는다.',
    '사용자의 사정을 지어내 아는 척하지 않는다: 편지에 없는 물건·시간·숫자·장소·사람("그 슬리퍼", "새벽 두 시에", "세 번째")을 꾸며 넣지 않는다. 편지에 적힌 것만 가지고 논다.',
    // 10/6 사용자: 유행하는 밈을 아는 척하는 대사도 가끔(맨날은 아님)
    '가끔만(열 번에 한두 번, 편지에 딱 들어맞을 때만) 요즘 유행어·밈을 아는 척한다 — 어디서 주워들은 어르신처럼 "요즘은 ~라고 한다더군", "~라던가" 하고 살짝 어색하게. 누구나 아는 것만 쓰고, 지어내지 않는다. 맞는 게 없으면 쓰지 않는다. 밈을 설명하지 않는다.',
    '단, 정말 무거운 일(누가 죽었다, 죽고 싶다, 크게 아프다)이면 농담을 접는다 — 비유·소품 없이 담담한 한 문장만. 예: "그랬군. 오늘은 말을 줄이겠네."',
    '이런 틀은 쓰지 않는다(다들 이렇게 써서 뻔하다): "~에 어울리는 곡들이지/이네", "~를 위한 곡", "~해 줄 곡", "자네 마음을 다 알고 있네", "기특하네", "편히 쉬게나", 상황을 그대로 되풀이하는 첫 문장.',
    '과장·감탄사·명언조·위로 명언 금지. 한 문장이 제일 좋고 길어도 두 문장. 곡 이름·가수 이름은 말하지 않는다.',
    '예(결만 참고한다. 문장·소재를 그대로 가져오지 말고 이 요청에 맞게 새로 쓴다):',
    '  "치킨 시켰는데 한 시간째 안 와" → "한 시간이면 닭이 걸어와도 도착했지."',
    '  "고양이가 나를 무시해" → "무시가 아니라 심사 중이네. 자네는 아직 수습이거든."',
    '  "양말 한 짝이 없어졌어" → "양말은 원래 혼자 떠나네. 남은 쪽이 더 딱하지."', // 흔한 상황(시험 망했어)을 예로 두면 비슷한 편지에 그대로 베껴 쓴다 — "발표 망했어" 에 "성적표" 가 나왔다
    '  "오늘도 야근" → "회사가 자네를 참 좋아하네. 놓아줄 생각이 없는 걸 보면."',
    '  "의심돼" → "의심은 대개 맞지. 그래서 다들 모르는 척하는 거고."',
    '  (밈을 아는 척 — 가끔만) "비 와서 약속 취소됐어" → "이럴 때 요즘은 \'오히려 좋아\' 라고 한다더군. 뭐가 좋은지는 아직 못 들었네."',
    '영어 대사(line_en)는 같은 뜻을 여유롭고 위트 있는 구어체로 (casual, confident, warm, dry wit).',
    '영어 대사에는 목소리 연기 지문을 0~2개 넣어도 된다 — 대괄호 영어, 그 말 바로 앞에: [chuckles] [sighs] [laughs softly] [whispers] [clears throat] [dryly] 같은 것. 꼭 필요할 때만, 한국어 대사(line_ko)에는 넣지 않는다.',
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
