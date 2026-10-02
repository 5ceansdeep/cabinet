/* 1단계 점수 = A × 뜻(벡터 코사인) + (1 − A) × 소리(에너지·밝기 거리) — docs/recommend-plan.md 6장.
   ponytail: A 는 Claude 초안 평가 세트 30개로 고른 값 — 세트를 고치거나 곡이 늘면 npm run eval 로 다시 고른다 */

export const A = 0.5; // 9/30 평가 세트 30개: 평균 빼기 + 0.5 가 29/30·재현율 68% 로 가장 좋았다(0.6 은 67%, 뜻만 1.0 은 61%)
const DEAD = 0.1; // 목표 숫자와 이만큼 안쪽이면 차이 없음 — Gemini 숫자는 대충의 감이다

/** 두 벡터 모두 길이 1 이면 내적 = 코사인 */
export const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);

type Sound = { energy: number | null; valence: number | null };

/** 소리 일치도 0~1 — 요청이 말한 축만. 잴 게 없으면 null(뜻만으로) */
export function soundScore(track: Sound, want: Sound): number | null {
  const gaps: number[] = [];
  for (const k of ['energy', 'valence'] as const) {
    const w = want[k];
    const t = track[k];
    if (w === null || t === null) continue;
    gaps.push(Math.max(0, Math.abs(w - t) - DEAD));
  }
  return gaps.length ? 1 - gaps.reduce((s, g) => s + g, 0) / gaps.length : null;
}

export const total = (meaning: number, sound: number | null, a = A) => (sound === null ? meaning : a * meaning + (1 - a) * sound);

/** 던진 곡들 쪽에서 요청 벡터를 밀어낸다 — 다시 찾을 때 비슷한 곡이 덜 나오게. 결과도 길이 1 */
export function away(query: number[], thrown: number[][], k = 0.3): number[] {
  if (!thrown.length) return query;
  const v = query.map((x, i) => x - (k * thrown.reduce((s, t) => s + (t[i] ?? 0), 0)) / thrown.length);
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

/** 곡 풀 평균을 빼고 다시 길이 1 로 — 곡 설명이 다들 비슷해("밤·혼자·아련함") 평균에 가까운 곡이 어느 요청에나 끼는 것(허브)을 막는다 */
export function centerer(vectors: number[][]) {
  if (!vectors.length) return (v: number[]) => v;
  const mean = vectors[0].map((_, i) => vectors.reduce((s, v) => s + v[i], 0) / vectors.length);
  return (v: number[]) => {
    const c = v.map((x, i) => x - mean[i]);
    const n = Math.hypot(...c) || 1;
    return c.map((x) => x / n);
  };
}

export type Candidate = Sound & { id: string; artist: string; vector: number[]; title?: string; description?: string | null };
export type Want = Sound & { vector: number[]; words?: string[] };

/* 글자 일치 가산 — 요청 낱말(해석의 words, 한·영)이 곡 제목에 있으면 크게, 곡 설명 [핵심어]에 있으면 작게.
   "미쳤어" 의 뜻 벡터는 위로곡 쪽으로 가도 제목이 "Crazy" 인 곡은 올라온다. ponytail: 값은 평가 45개로 고른 것 */
export const BONUS = { title: 0.1, key: 0.04 };
const flat = (s: string) => s.toLowerCase().replace(/\s+/g, '');
const keysOf = (description: string) => [...description.matchAll(/\[([^\]]*)\]/g)].flatMap((m) => m[1].split(',').map(flat)).filter(Boolean);

export function lexical(t: { title?: string; description?: string | null }, words: string[] = [], bonus = BONUS) {
  const ws = words.map(flat).filter(Boolean);
  if (!ws.length) return 0;
  const title = flat(t.title ?? '');
  if (ws.some((w) => title.includes(w))) return bonus.title; // "비" 는 "비밀" 에도 걸린다 — 제목은 짧아 드물다
  const keys = keysOf(t.description ?? '');
  return ws.some((w) => keys.some((k) => k === w || (w.length > 1 && k.includes(w)))) ? bonus.key : 0;
}

const PER_ARTIST = 2; // 가수당 앞에 두는 곡 수 — 1 이면 같은 가수 둘째 곡이 100등 밖으로 밀렸다(9/30 FANCY 가 합산 2~3등감인데 111등)

const THROW_STEP = 0.01; // 최근에 던져진 한 번마다 깎는 점수(점수는 0~1) — ponytail: 감으로 정한 값, 던진 기록이 쌓이면 평가로 다시
const THROW_MAX = 0.05; // 아무리 많이 던져져도 이만큼까지 — 어떤 요청엔 맞는 곡일 수 있다

/** 던진 횟수 → 깎을 점수. ponytail: 보여 준 횟수로 나누지 않는다(노출 기록이 없다) — 자주 나오는 곡이 더 깎인다 */
export const throwPenalty = (n: number) => Math.min(THROW_MAX, THROW_STEP * n);

/** 곡 풀 전체 순위 — seen·thrown 은 빼고, 가수당 PER_ARTIST 곡까지 먼저(한 가수로 몰리지 않게), 모자라면 나머지.
    penalty = 곡 id → 깎을 점수(사람들이 자주 던진 곡) */
export function rank<T extends Candidate>(
  pool: T[],
  want: Want,
  opts: { seen?: string[]; thrown?: string[]; a?: number; center?: boolean; penalty?: Map<string, number>; bonus?: typeof BONUS } = {},
) {
  const { seen = [], thrown = [], a = A, center = true, penalty, bonus = BONUS } = opts;
  const fix = center ? centerer(pool.map((t) => t.vector)) : (v: number[]) => v;
  const vecs = new Map(pool.map((t) => [t.id, fix(t.vector)]));
  const vector = away(fix(want.vector), thrown.map((id) => vecs.get(id)).filter((v) => !!v));
  const skip = new Set([...seen, ...thrown]);
  const ranked = pool
    .filter((t) => !skip.has(t.id))
    .map((t) => ({ ...t, score: total(Math.max(0, dot(vector, vecs.get(t.id)!)), soundScore(t, want), a) + lexical(t, want.words, bonus) - (penalty?.get(t.id) ?? 0) }))
    .sort((x, y) => y.score - x.score);
  const count = new Map<string, number>();
  const first = ranked.filter((t) => {
    const n = count.get(t.artist) ?? 0;
    count.set(t.artist, n + 1);
    return n < PER_ARTIST;
  });
  return [...first, ...ranked.filter((t) => !first.includes(t))];
}

/** 화면 일치도(%) — 코사인은 곡끼리 86~93% 에 몰려 차이가 안 보인다. 이 요청에서 가장 맞는 곡 99, 가장 먼 곡 60 으로 늘린다(순위는 그대로) */
export function display(score: number, lo: number, hi: number) {
  return hi > lo ? Math.round(60 + (39 * (score - lo)) / (hi - lo)) : 99;
}
