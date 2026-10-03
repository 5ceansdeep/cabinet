/* 고정 대사 녹음 — docs/voice-script.csv 의 줄 중 frontend/public/voice 에 mp3 가 없는 것만 ElevenLabs 로 만들어 저장한다.
   있는 파일은 건너뛰니 몇 번을 돌려도 새 줄에만 크레딧이 든다. 다시 녹음하려면 그 mp3 를 지우고 돌린다.
   npm run voice (backend/.env 의 ELEVENLABS_API_KEY·VOICE_ID·MODEL, 목소리 설정은 backend/voice-settings.json) */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const out = new URL('frontend/public/voice/', root);
const { ELEVENLABS_API_KEY: key, ELEVENLABS_VOICE_ID: voice, ELEVENLABS_MODEL: model = 'eleven_v3' } = process.env;
if (!key || !voice) throw new Error('backend/.env 에 ELEVENLABS_API_KEY·ELEVENLABS_VOICE_ID 가 없다');
const settings = JSON.parse(readFileSync(new URL('../voice-settings.json', import.meta.url), 'utf8'));

const rows = readFileSync(new URL('docs/voice-script.csv', root), 'utf8')
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((l) => {
    const i = l.indexOf(',');
    const text = l.slice(i + 1).replace(/^"|"$/g, '').replaceAll('""', '"');
    // v3 는 <break> 를 모른다(소리 내 읽거나 무시) — 쉼은 말줄임표로
    return { file: l.slice(0, i), text: model.startsWith('eleven_v3') ? text.replace(/<break[^>]*\/>/g, '… ') : text };
  });

const todo = rows.filter((r) => !existsSync(new URL(r.file, out)));
console.log(`대본 ${rows.length}줄, 녹음 없는 ${todo.length}줄`);
for (const { file, text } of todo) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
  });
  if (!res.ok) {
    console.error(`${file}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(new URL(file, out), Buffer.from(await res.arrayBuffer()));
  console.log(`${file} ✓ (${text.length}자)`);
}
