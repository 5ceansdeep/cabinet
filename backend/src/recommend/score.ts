/* 1단계 점수 = A × 뜻(벡터 코사인) + (1 − A) × 소리(에너지·밝기 거리) — docs/recommend-plan.md 6장.
   ponytail: A 는 감으로 정한 값 — 평가 세트(7장)가 생기면 그걸로 고른다 */

export const A = 0.6;
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

export const total = (meaning: number, sound: number | null) => (sound === null ? meaning : A * meaning + (1 - A) * sound);

/** 던진 곡들 쪽에서 요청 벡터를 밀어낸다 — 다시 찾을 때 비슷한 곡이 덜 나오게. 결과도 길이 1 */
export function away(query: number[], thrown: number[][], k = 0.3): number[] {
  if (!thrown.length) return query;
  const v = query.map((x, i) => x - (k * thrown.reduce((s, t) => s + (t[i] ?? 0), 0)) / thrown.length);
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}
