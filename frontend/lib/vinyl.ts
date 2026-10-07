/* LP 판 도는 소리 — 잔잔한 지직거림에 가끔 "틱". 서서히 커졌다가(페이드 인) 곡이 올라오면 잦아든다.
   미리듣기가 끝나고 다음 곡으로 이어질 때 깐다(PlayerBar). thud 처럼 그때그때 합성 — 파일 없음 */
export function vinyl(sec = 2.8) {
  const ctx = new AudioContext();
  const n = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    d[i] = (Math.random() * 2 - 1) * 0.02; // 바탕 지직
    if (Math.random() < 0.0005) d[i] += (Math.random() * 2 - 1) * 0.7; // 먼지 "틱" — 초당 스무 번쯤
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = new BiquadFilterNode(ctx, { type: "bandpass", frequency: 2400, Q: 0.5 }); // 날카로운 끝을 깎아 판 소리답게
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.9, t + 0.6);
  gain.gain.setValueAtTime(0.9, t + sec - 1.4);
  gain.gain.linearRampToValueAtTime(0, t + sec);
  src.connect(band).connect(gain).connect(ctx.destination);
  src.start(t);
  src.onended = () => ctx.close();
}
