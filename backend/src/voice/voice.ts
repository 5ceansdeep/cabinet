import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Controller, Get, Injectable, Logger, Module, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/* 신의 한마디 영어 음성 — ElevenLabs. 요청마다 새로 생기는 대사(rerank.ts 의 line.en)만 여기서 만든다.
   고정 대사는 public/voice/{키}.mp3 로 미리 녹음해 둔다(docs/voice-script.csv).
   ELEVENLABS_ENABLED=true 일 때만 — 크레딧을 아끼려고 평소엔 꺼 둔다. 꺼져 있으면 프론트는 기계 음성으로 자막을 읽는다.
   아무 글이나 읽히지 못하게, 프론트는 글이 아니라 서버가 만든 대사의 id 만 보낸다.
   만든 음성은 파일로 남긴다 — 같은 요청은 같은 대사라(온도 0) 두 번째부터 크레딧이 안 든다.
   ponytail: id → 영어 대사는 메모리(최근 LINES_MAX) — 서버를 끄면 아직 안 만든 대사는 못 찾는다(프론트는 기계 음성으로) */

const DIR = '.voice-cache';
const LINES_MAX = 500;
const MODEL = 'eleven_multilingual_v2'; // 고정 대사 녹음과 같은 목소리 결 — 싸게 가려면 eleven_flash_v2_5(크레딧 절반)

@Injectable()
export class VoiceService {
  private readonly log = new Logger('Voice');
  private readonly enabled: boolean;
  private readonly key?: string;
  private readonly voiceId?: string;
  private readonly lines = new Map<string, string>(); // id → 영어 대사
  private readonly making = new Map<string, Promise<Buffer | null>>(); // 같은 대사를 동시에 두 번 만들지 않게

  constructor(config: ConfigService) {
    this.enabled = config.get('ELEVENLABS_ENABLED') === 'true';
    if (!this.enabled) return;
    // 켰으면 키·목소리가 꼭 있어야 한다 — 없으면 서버가 안 켜진다
    const must = (k: string) => {
      const v = config.get<string>(k)?.trim();
      if (!v) throw new Error(`ELEVENLABS_ENABLED=true 인데 ${k} 가 비었다`);
      return v;
    };
    this.key = must('ELEVENLABS_API_KEY');
    this.voiceId = must('ELEVENLABS_VOICE_ID');
    mkdirSync(DIR, { recursive: true });
  }

  /** 대사를 올려 두고 id 를 준다. 꺼져 있으면 null */
  register(en: string): string | null {
    if (!this.enabled || !en.trim()) return null;
    const id = createHash('sha256').update(en).digest('hex').slice(0, 16);
    this.lines.set(id, en);
    if (this.lines.size > LINES_MAX) this.lines.delete(this.lines.keys().next().value!);
    return id;
  }

  /** mp3 — 파일에 있으면 그걸, 없으면 올려 둔 대사로 만든다. 모르는 id·꺼짐·실패는 null */
  async audio(id: string): Promise<Buffer | null> {
    if (!this.enabled || !/^[0-9a-f]{16}$/.test(id)) return null;
    const file = `${DIR}/${id}.mp3`;
    if (existsSync(file)) return readFileSync(file);
    const en = this.lines.get(id);
    if (!en) return null;
    let p = this.making.get(id);
    if (!p) {
      p = this.make(en, file).finally(() => this.making.delete(id));
      this.making.set(id, p);
    }
    return p;
  }

  private async make(text: string, file: string): Promise<Buffer | null> {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': this.key!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: MODEL }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        this.log.warn(`ElevenLabs ${res.status} ${(await res.text()).slice(0, 200)}`); // 401 키·402/429 크레딧
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, buf);
      return buf;
    } catch (e) {
      this.log.warn(`ElevenLabs 실패: ${e}`);
      return null;
    }
  }
}

@ApiTags('voice')
@Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Get(':id')
  @ApiOperation({ summary: '신의 한마디 영어 음성(mp3) — id 는 /recommend 응답의 line.voice. ELEVENLABS_ENABLED 가 꺼져 있으면 404' })
  async get(@Param('id') id: string) {
    const buf = await this.voice.audio(id);
    if (!buf) throw new NotFoundException('목소리가 안 나오네');
    return new StreamableFile(buf, { type: 'audio/mpeg' });
  }
}

@Module({ controllers: [VoiceController], providers: [VoiceService], exports: [VoiceService] })
export class VoiceModule {}
