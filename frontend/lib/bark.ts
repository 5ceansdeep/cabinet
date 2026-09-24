/* 왈왈 — "지나가던 개도 맞히겠네" 뒤에 지나가는 개 소리. 음원 없이 Web Audio 로 합성한다.
   ponytail: 합성이라 진짜 개 같진 않다 — 녹음 파일이 생기면 <audio> 재생으로 바꾸면 된다 */
export function bark(times = 2) {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.25;
  master.connect(ctx.destination);

  for (let n = 0; n < times; n++) {
    const t = ctx.currentTime + n * 0.28;
    // 짧게 터지는 잡음 — 개 짖는 소리의 몸통
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    noise.buffer = buf;

    // 입을 벌렸다 닫듯 주파수를 훑는 필터
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 4;
    band.frequency.setValueAtTime(900, t);
    band.frequency.exponentialRampToValueAtTime(380, t + 0.12);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    noise.connect(band).connect(g).connect(master);
    noise.start(t);
    noise.stop(t + 0.2);

    // 울림을 주는 낮은 음
    const tone = ctx.createOscillator();
    const tg = ctx.createGain();
    tone.type = "sawtooth";
    tone.frequency.setValueAtTime(320, t);
    tone.frequency.exponentialRampToValueAtTime(150, t + 0.14);
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    tone.connect(tg).connect(master);
    tone.start(t);
    tone.stop(t + 0.2);
    if (n === times - 1) tone.onended = () => ctx.close();
  }
}
