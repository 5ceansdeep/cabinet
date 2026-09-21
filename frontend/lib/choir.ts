/* 성스러운 브금 — 디튠된 톱니파 합창 패드 + 반짝이는 벨, 긴 리버브. 음원 파일 없이 Web Audio 로 합성.
   startChoir() 는 멈추는 함수를 돌려준다 (useEffect cleanup 으로 그대로 쓰도록) */
export function startChoir() {
  const ctx = new AudioContext();
  const t0 = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(0.16, t0 + 2.5);
  master.connect(ctx.destination);

  // 리버브: 3.5초 동안 감쇠하는 노이즈 임펄스
  const verb = ctx.createConvolver();
  const len = ctx.sampleRate * 3.5;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.8;
  verb.connect(wet).connect(master);

  // "아—" 하는 합창: 톱니파를 부드럽게 깎고, 필터를 천천히 숨 쉬게
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1300;
  filter.Q.value = 0.7;
  filter.connect(master);
  filter.connect(verb);
  const breath = ctx.createOscillator();
  const breathDepth = ctx.createGain();
  breath.frequency.value = 0.15;
  breathDepth.gain.value = 400;
  breath.connect(breathDepth).connect(filter.frequency);
  breath.start();

  const vibrato = ctx.createOscillator();
  const vibratoDepth = ctx.createGain();
  vibrato.frequency.value = 5;
  vibratoDepth.gain.value = 6; // cents
  vibrato.connect(vibratoDepth);
  vibrato.start();

  // D 장조 add9 — 밝고 열린 화음
  const oscs = [breath, vibrato];
  for (const f of [146.83, 220, 293.66, 369.99, 440, 659.25]) {
    for (const cents of [-7, 7]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = cents;
      vibratoDepth.connect(o.detune);
      g.gain.value = 0.05;
      o.connect(g).connect(filter);
      o.start();
      oscs.push(o);
    }
  }

  // 반짝이는 벨 — 화음 안의 높은 음을 무작위로
  const bells = [1174.66, 1318.51, 1479.98, 1760, 2349.32];
  const bell = setInterval(() => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = bells[Math.floor(Math.random() * bells.length)];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g);
    g.connect(verb);
    g.connect(master);
    o.start(t);
    o.stop(t + 1.7);
  }, 450);

  return () => {
    clearInterval(bell);
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 1.2);
    setTimeout(() => {
      oscs.forEach((o) => o.stop());
      ctx.close();
    }, 1400);
  };
}
