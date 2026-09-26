import type { Tags } from '../catalog/lastfm.js';

/* 태그 가중치끼리 코사인 유사도 (DRIFT recommend.service 의 cosineSimilarity 를 희소 맵으로).
   pick 을 주면 그 태그들만 놓고 잰다 — 분위기 일치도 */
export function cosine(a: Tags, b: Tags, pick?: Set<string>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, w] of Object.entries(a)) {
    if (pick && !pick.has(t)) continue;
    na += w * w;
    dot += w * (b[t] ?? 0);
  }
  for (const [t, w] of Object.entries(b)) if (!pick || pick.has(t)) nb += w * w;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/* 던져 버린 곡의 태그만큼 요청을 반대로 민다 — 다시 찾을 때 비슷한 곡이 덜 나오게 */
export function push(query: Tags, away: Tags[], k = 0.5): Tags {
  const out = { ...query };
  for (const tags of away) {
    const max = Math.max(1, ...Object.values(tags));
    for (const [t, w] of Object.entries(tags)) out[t] = (out[t] ?? 0) - (k * 100 * w) / max / away.length;
  }
  return out;
}
