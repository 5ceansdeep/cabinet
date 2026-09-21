/* 아날로그 "탁" — 짧게 떨어지는 저음 펄스. 낮은 freq 일수록 "쾅" */
export function thud(freq = 110) {
  const ctx = new AudioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(freq * 2, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.18);
  osc.onended = () => ctx.close();
}
