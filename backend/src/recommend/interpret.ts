import { Injectable, Logger } from '@nestjs/common';
import { describeText, type Parts } from '../catalog/describe.js';
import { Gemini, MODELS } from '../catalog/gemini.js';
import { GENRES } from '../catalog/genres.js';

/* 요청문 → "이런 곡이면 좋겠다" 설명 + 목표 에너지·밝기 → 벡터 (docs/recommend-plan.md 6장).
   요청문을 바로 임베딩하지 않고 곡 설명과 같은 틀(감정/상황/가사/소리)로 풀어 쓴 뒤 임베딩한다 — 같은 말투끼리 비교해야 잘 맞는다.
   같은 문장이면 같은 결과: 온도 0 + 정규화한 문장으로 캐시.
   Gemini 대화 모델이 막히면(무료 한도) 요청문을 그대로 임베딩해 뜻만으로 — 임베딩 한도는 따로다.
   ponytail: 캐시는 메모리(최근 CACHE_MAX 문장) — 서버를 끄면 비고, 여러 대로 늘리면 DB 로 옮긴다 */

export type Asked = {
  keywords: string[]; // 화면 "요청 해석"
  tags?: string[]; // Last.fm 영어 태그 — 검색 기록(SearchLog)에 남겨 곡 풀 넓히기 씨앗으로
  artists?: string[]; // 사용자가 직접 말한 가수(한글·원래 표기) — 그 가수 곡을 앞에
  songs?: { title: string; artist: string }[]; // 사용자가 꼽은 곡 — 그 곡과 결이 비슷한 곡을(10/2)
  genres?: string[]; // 사용자가 직접 말한 장르 키(catalog/genres.ts GENRES) — 편지지 장르 칩과 같이 쓴다
  description: string; // 풀어 쓴 설명 — 보고서에 곡 설명과 나란히
  vector: number[];
  energy: number | null; // 요청이 소리의 세기·밝기를 말할 때만
  valence: number | null;
  words?: string[]; // 곡 제목·가사에 그대로 나올 낱말(한·영) — 1단계 글자 일치 가산(score.ts lexical)
  alt?: Reading; // 짧고 여러 뜻으로 읽히는 요청의 두 번째 읽기 — 10곡을 두 읽기로 반반(recommend.ts stage1)
};
export type Reading = Pick<Asked, 'keywords' | 'description' | 'vector' | 'energy' | 'valence'>;

const CACHE_MAX = 500;

/* 곡 설명 틀(감정/상황/가사/소리) + 세기·밝기 — 첫 읽기와 두 번째 읽기(alt)가 같이 쓴다 */
const READING = {
  emotion: { type: 'STRING', description: '[핵심어 3개] + 들려줄 곡이 주면 좋을 감정 한두 문장. 예: "[이별, 미련, 그리움] 헤어진 사람을 잊지 못하고 지난 기억을 되새기는 마음이다."' },
  situation: { type: 'STRING', description: '[핵심어 3개] + 이 사람이 있는 상황·때·장소 한두 문장. 예: "[이별 후, 혼자 있을 때, 밤] 홀로 남아 지나간 사람을 생각하며 마음을 정리하는 시간이다."' },
  lyrics: { type: 'STRING', description: '[핵심어 2~3개] + 곡의 가사가 말하면 좋을 것 한두 문장. 예: "[이별, 잊지 못함, 추억] 아직 상대를 보내지 못하고 그리워하는 가사다."' },
  sound: { type: 'STRING', description: '[핵심어 3개] + 어울리는 소리 한두 문장. 예: "[잔잔함, 쓸쓸함, 애절함] 조용히 감정을 다독이는 소리다."' },
  energy: { type: 'NUMBER', nullable: true, description: '0(조용한)~1(격한). 요청이 세기를 드러낼 때만, 아니면 null' },
  valence: { type: 'NUMBER', nullable: true, description: '0(슬픈·어두운)~1(밝은). 요청이 밝기를 드러낼 때만, 아니면 null' },
  usage: {
    type: 'STRING',
    description: '[핵심어 2~3개] + 이 요청에 맞는 곡이 쓰일 법한 장면 한 문장 — 드라마·영화 장면, 예능 자막 브금, 밈, 숏폼 챌린지. 예: "[예능 브금, 추리, 긴장] 누군가를 의심하며 몰래 뒤를 밟는 예능 장면에 깔리는 곡이다."',
  },
};

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    keywords: { type: 'ARRAY', items: { type: 'STRING' }, description: '요청을 어떻게 읽었는지 짧은 한국어 말 3~5개 (예: 퇴근길, 지친 하루, 위로)' },
    tags: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description:
        '어울리는 곡에 붙을 법한 Last.fm 영어 태그 2~3개, 소문자 (예: melancholy, rainy day, driving). ' +
        '보컬 성별을 직접 말했거나("여자 보컬", "남자 목소리") "○○ 같은" 으로 꼽은 가수의 성별이 분명하면(그 가수 자신의 곡을 원한 게 아니어도) "female vocalists"/"male vocalists" 를 포함한다.',
    },
    artists: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: '사용자가 그 가수 본인 곡을 듣고 싶다고 말했을 때만, 한글·원래 표기 둘 다 (예: "오아시스" → ["오아시스", "Oasis"], "nct" → ["엔시티", "NCT"]). "○○ 같은/느낌/풍"처럼 결만 빌린 거면 비워 둔다. 말하지 않았으면 빈 배열',
    },
    genres: { type: 'ARRAY', items: { type: 'STRING', enum: Object.keys(GENRES) }, description: '사용자가 직접 말한 장르만. 말하지 않았으면 빈 배열' },
    songs: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, artist: { type: 'STRING' } }, required: ['title', 'artist'] },
      description: '사용자가 직접 꼽은 곡만(제목·가수, 가수는 아는 표기로). 예: "검정치마 Everything 같은 노래" → [{title:"Everything", artist:"검정치마"}]. 말하지 않았으면 빈 배열',
    },
    ...READING,
    words: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: '요청에 나온 낱말 중 곡 제목·가사에 그대로 나올 법한 말 0~5개 — 원형·활용형과 영어 (예: "미쳤어" → ["미쳤어", "미친", "crazy"], "비 오는 밤" → ["비", "rain", "밤", "night"]). 풀어 쓴 감정·상황 말은 넣지 않는다',
    },
    alt: {
      type: 'OBJECT',
      nullable: true,
      description: '요청이 짧고 여러 뜻으로 읽힐 때만 두 번째로 그럴듯한 읽기(예: "미쳤어" — 신나서 / 화나서 / 지쳐서). 첫 읽기와 결이 달라야 한다. 뜻이 하나로 분명하면 null',
      properties: { keywords: { type: 'ARRAY', items: { type: 'STRING' }, description: '이 읽기를 짧은 한국어 말 2~4개로' }, ...READING },
      required: ['keywords', 'emotion', 'situation', 'lyrics', 'sound'],
    },
  },
  required: ['keywords', 'emotion', 'situation', 'lyrics', 'sound'],
};

export const promptFor = (query: string) =>
  [
    '음악 추천 서비스. 사용자가 적은 문장을 읽고, 이 사람에게 들려줄 곡이 어떤 곡이면 좋을지 곡 설명 틀로 쓴다.',
    '이 설명을 곡들의 설명(감정/상황/가사/소리)과 비교해 곡을 고른다. 곡 설명과 같은 형식으로 —',
    '각 항목은 대괄호 핵심어로 시작하고(검색에 쓰는 흔한 말: 이별·미련·설렘·외로움·위로·신남·출근길·드라이브·운동·새벽·잔잔함·경쾌함 등), 이어서 한국어 한두 문장. 끝은 "~다".',
    '먼저 요청이 어떤 종류인지 읽고 거기에 맞춘다:',
    '- 구체적인 소재·몸 상태를 말하면(배고파, 비 온다, 이사했어) 그 소재를 직접 노래하는 곡이 먼저다. 가사 항목에 그 낱말을 그대로 쓴다 (예: "배고파" → 가사가 배고픔·먹고 싶은 것을 말한다).',
    '- 감정을 말하면(슬퍼, 신나, 설레) 그 감정에 같이 머무는 곡. 슬픈 사람에게 밝은 응원가를 주지 않는다 — 슬픈 곡으로 같이 운다.',
    '- 지치거나 힘들다고 하면(지쳤어, 번아웃, 버티는 중) 조용하고 다정한 위로. 소리는 잔잔하게, 가사는 괜찮다고 다독인다.',
    '- 하는 일·장소를 말하면(드라이브, 공부, 청소) 그 일에 어울리는 소리와 분위기.',
    '- 인사처럼 음악과 상관없는 말("안녕하세요")이면 그 말을 하는 사람의 기분을 짐작한다.',
    '- 가수·장르를 직접 말하면(그 가수 곡을 듣고 싶다는 뜻 — "오아시스의 신나는 노래", "재즈 듣고 싶어") artists·genres 에 담는다. 그 가수·장르의 결을 소리 항목에도.',
    '- 곡을 꼽으면("○○ 같은 노래", "○○ 듣고 비슷한 거") songs 에 담고, 그 곡의 결(감정·소리)을 틀에 풀어 쓴다. 그 가수 곡만 원한 게 아니면 artists 에는 넣지 않는다.',
    '- 가수 이름 뒤에 "같은/느낌/스타일/풍"이 붙으면("빈지노 같은 힙합", "아이유 느낌 보컬") 그 가수 본인 곡을 듣고 싶다는 뜻이 아니다 — artists 에 넣지 말고, 그 가수의 결(감정·소리)만 틀에 풀어 쓴다.',
    '사용자가 말하지 않은 가수·장르·곡 이름은 지어내지 않는다.',
    '한두 낱말처럼 짧고 여러 뜻으로 읽히는 요청("미쳤어", "백색", "헐")은 가장 그럴듯한 읽기를 위 틀에, 결이 다른 두 번째 읽기를 alt 에. 처방(위로)으로만 몰지 말고 그 말의 기분 자체도 읽는다.',
    '',
    `사용자: ${query}`,
  ].join('\n');

/** 곡 설명 틀 + 쓰임 장면(요청 쪽에만) — 10/2 표본: 요청에 "이런 장면에 쓰일 곡"을 붙이면 재현율 41 → 46%.
    곡 설명에도 쓰임을 넣으면 39% 로 나빠졌다(아는 곡만 칸이 생겨 그 곡들끼리 비슷해짐) — 그래서 곡 쪽엔 없다 */
const withUsage = (p: Parts & { usage?: string }) => describeText(p) + (p.usage ? `\n쓰임: ${p.usage}` : '');

const clamp = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : null);
export const normalize = (q: string) => q.trim().replace(/\s+/g, ' ').toLowerCase();

@Injectable()
export class Interpreter {
  private readonly log = new Logger('Interpret');
  private readonly cache = new Map<string, Asked>();

  constructor(private readonly gemini: Gemini) {}

  /** 이미 해석해 둔 편지만 — 없으면 undefined(새로 묻지 않는다, 돈 안 듦) */
  cached(query: string) {
    return this.cache.get(normalize(query));
  }

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
      type Read = Parts & { keywords?: string[]; energy?: number | null; valence?: number | null; usage?: string };
      const p = JSON.parse(await this.gemini.generate(MODELS.query, promptFor(query), SCHEMA)) as Read & {
        tags?: string[];
        artists?: string[];
        genres?: string[];
        songs?: { title?: string; artist?: string }[];
        words?: string[];
        alt?: Read | null;
      };
      const description = withUsage(p);
      const altText = p.alt?.emotion ? withUsage(p.alt) : null;
      const [vector, altVector] = await Promise.all([this.gemini.embed(description), altText ? this.gemini.embed(altText) : null]); // 임베딩 둘은 같이
      return {
        keywords: (p.keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 5),
        tags: (p.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 3),
        artists: (p.artists ?? []).map((a) => a.trim()).filter(Boolean).slice(0, 6),
        songs: (p.songs ?? []).filter((s) => s.title?.trim() && s.artist?.trim()).slice(0, 3).map((s) => ({ title: s.title!.trim(), artist: s.artist!.trim() })),
        genres: (p.genres ?? []).filter((g) => g in GENRES),
        description,
        vector,
        energy: clamp(p.energy),
        valence: clamp(p.valence),
        words: (p.words ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean).slice(0, 5),
        alt:
          p.alt && altText && altVector
            ? { keywords: (p.alt.keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 4), description: altText, vector: altVector, energy: clamp(p.alt.energy), valence: clamp(p.alt.valence) }
            : undefined,
      };
    } catch (e) {
      // 대화 모델이 막혔다 — 요청문 그대로 (이것도 실패하면 위로 던진다)
      this.log.warn(`풀어 쓰기 실패, 요청문 그대로 임베딩: ${e}`);
      return { keywords: [], description: query, vector: await this.gemini.embed(query), energy: null, valence: null };
    }
  }
}
