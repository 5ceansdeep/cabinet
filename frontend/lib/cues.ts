/* 음성 파일 분석 — 문장이 시작하는 시각들과 말이 끝나는 시각(초).
   ElevenLabs 스크립트의 <break time="0.5s"/> 쉼이 문장 경계. 음성엔 잔향이 있어 쉼 동안에도 소리가 최고 음량의 5~15% 남으므로
   "최고 음량의 QUIET 미만"을 조용한 구간으로 보고, 말소리 사이 조용한 구간 중 가장 긴 count-1 개를 문장 경계로 고른다
   (자막 줄 수 = count 를 알고 있으니, 쉼표 같은 짧은 숨보다 0.5초 break 가 늘 더 길다는 점을 이용).
   end 는 마지막 말소리 — 파일 끝의 긴 공백은 무시하고 다음 대사를 이어 붙이는 데 쓴다 */

const WINDOW = 0.02; // 초
const QUIET = 0.15; // 최고 음량 대비 이 비율 미만이면 조용함

export function analyzeSpeech(samples: Float32Array, rate: number, count: number): { starts: number[]; end: number } {
  const size = Math.max(1, Math.round(rate * WINDOW));
  const rms: number[] = [];
  for (let i = 0; i < samples.length; i += size) {
    let sum = 0;
    const end = Math.min(i + size, samples.length);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    rms.push(Math.sqrt(sum / (end - i)));
  }
  const peak = rms.reduce((m, v) => Math.max(m, v), 0);
  const loud = rms.map((v) => v >= peak * QUIET);
  const first = loud.indexOf(true);
  const last = loud.lastIndexOf(true);
  if (first < 0) return { starts: [], end: 0 };

  // 첫 소리와 마지막 소리 사이의 조용한 구간들 — [시작 창, 끝 창)
  const gaps: { from: number; to: number }[] = [];
  for (let i = first; i <= last; i++) {
    if (loud[i]) continue;
    const from = i;
    while (!loud[i]) i++;
    gaps.push({ from, to: i });
  }
  const breaks = gaps
    .sort((a, b) => b.to - b.from - (a.to - a.from))
    .slice(0, count - 1)
    .map((g) => g.to * WINDOW) // 쉼이 끝나고 다음 문장이 시작하는 시각
    .sort((a, b) => a - b);
  return { starts: [first * WINDOW, ...breaks], end: (last + 1) * WINDOW };
}

// node --experimental-strip-types lib/cues.ts 로 자가 점검
if (typeof process !== "undefined" && process.argv[1]?.endsWith("cues.ts")) {
  const rate = 8000;
  const tone = (s: number) => Array.from({ length: s * rate }, (_, i) => Math.sin(i / 3) * 0.5);
  const tail = (s: number) => Array.from({ length: s * rate }, (_, i) => Math.sin(i / 5) * 0.04); // 잔향 — 최고의 8%
  // 0.1초 앞 여백, 1초 말, 쉼표 숨 0.15초, 0.8초 말, 0.5초 break(잔향), 1.2초 말, 긴 꼬리
  const sig = new Float32Array([...tail(0.1), ...tone(1), ...tail(0.15), ...tone(0.8), ...tail(0.5), ...tone(1.2), ...tail(3)]);
  const { starts, end } = analyzeSpeech(sig, rate, 2);
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.03; // 창 단위(20ms) 오차는 허용
  if (starts.length !== 2 || !near(starts[0], 0.1) || !near(starts[1], 2.55) || !near(end, 3.75))
    throw new Error(`analyzeSpeech ${JSON.stringify({ starts, end })}`);
  console.log("cues ok", { starts, end });
}
