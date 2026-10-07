import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Controller, Get, Header, Injectable, Logger, Module, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

/* 신의 한마디 영어 음성 — ElevenLabs. 요청마다 새로 생기는 대사(rerank.ts 의 line.en)만 여기서 만든다.
   고정 대사는 public/voice/{키}.mp3 로 미리 녹음해 둔다(docs/voice-script.csv).
   ELEVENLABS_ENABLED=true 일 때만 — 크레딧을 아끼려고 평소엔 꺼 둔다. 꺼져 있으면 프론트는 기계 음성으로 자막을 읽는다.
   아무 글이나 읽히지 못하게, 프론트는 글이 아니라 서버가 만든 대사의 id 만 보낸다.
   만든 음성은 DB(VoiceClip)에 남긴다 — 같은 편지는 같은 대사(LetterLine)라 두 번째부터 크레딧이 안 든다.
   10/4: 예전엔 서버 디스크(.voice-cache)였는데 Railway 는 배포마다 디스크를 비워 같은 대사를 다시 샀다.
   ponytail: id → 영어 대사는 메모리(최근 LINES_MAX) — 서버를 끄면 아직 안 만든 대사는 못 찾는다(프론트는 기계 음성으로) */

// 빠르기·안정성 등 — 고정 대사 녹음(scripts/voice.mjs)과 같은 파일. 서버는 backend 폴더에서 켜진다
const SETTINGS = readFileSync('voice-settings.json', 'utf8');
const LINES_MAX = 500;

/* 이름을 부르는 인사(랜딩) — 녹음해 둔 고정 대사(public/voice/*_VOICE.mp3)엔 이름이 없어 이름은 자막에만 나왔다.
   10/7 사용자: 목소리도 이름을 불렀으면(랜딩에서만 — 결과 화면 한마디는 이름을 안 부른다).
   문장은 docs/voice-script.csv 의 같은 줄에 이름만 넣은 것 — 쉼(<break>)도 그대로라 자막 줄이 같은 자리에서 넘어간다.
   닉네임·인사마다 한 번 만들어 VoiceClip 에 남는다(같은 닉네임이면 다시 안 산다) */
const GREETINGS = {
  login: 'Welcome back, {name}.<break time="0.5s"/>I kept your spot right where you left it.',
  signup: 'All set, {name}!<break time="0.5s"/>Easier than creating the universe, wasn\'t it?',
  returning: 'Look who\'s back, {name}.<break time="0.5s"/>Door\'s open.',
  reset: 'The new key fits perfectly, {name}.<break time="0.5s"/>Come on in.',
};
export type Greeting = keyof typeof GREETINGS;
/** 인사말에 이름을 넣는다 — 밑줄은 띄어 읽게. 닉네임은 가입 때 한글·영문·숫자·밑줄만 받아(SignupDto) 쉼 태그를 깨뜨릴 글자가 없다 */
export const greetingText = (kind: Greeting, nickname: string) => GREETINGS[kind].replace('{name}', () => nickname.replaceAll('_', ' '));

@Injectable()
export class VoiceService {
  private readonly log = new Logger('Voice');
  private readonly enabled: boolean;
  private readonly key?: string;
  private readonly voiceId?: string;
  // eleven_multilingual_v2(기본 — 10/6 사용자: 랜딩 고정 대사와 같은 목소리로. speed 0.7 이 먹는다) / eleven_v3(10/4~10/6, 지문을 알아듣지만 speed 를 무시해 빠르게 들렸다)
  private readonly model: string;
  private readonly lines = new Map<string, string>(); // id → 영어 대사
  private readonly making = new Map<string, Promise<Buffer | null>>(); // 같은 대사를 동시에 두 번 만들지 않게

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.enabled = config.get('ELEVENLABS_ENABLED') === 'true';
    this.model = config.get<string>('ELEVENLABS_MODEL')?.trim() || 'eleven_multilingual_v2';
    if (!this.enabled) return;
    // 켰으면 키·목소리가 꼭 있어야 한다 — 없으면 서버가 안 켜진다
    const must = (k: string) => {
      const v = config.get<string>(k)?.trim();
      if (!v) throw new Error(`ELEVENLABS_ENABLED=true 인데 ${k} 가 비었다`);
      return v;
    };
    this.key = must('ELEVENLABS_API_KEY');
    this.voiceId = must('ELEVENLABS_VOICE_ID');
  }

  /** 대사를 올려 두고 id 를 준다. 꺼져 있으면 null */
  register(en: string): string | null {
    if (!this.enabled || !en.trim()) return null;
    // 모델·설정도 id 에 — 바꾸면 예전 것으로 만든 파일을 다시 쓰지 않게
    const id = createHash('sha256').update(`${this.model}|${SETTINGS}|${en}`).digest('hex').slice(0, 16);
    this.lines.set(id, en);
    if (this.lines.size > LINES_MAX) this.lines.delete(this.lines.keys().next().value!);
    return id;
  }

  /** 이름을 부르는 인사의 음성 id — 꺼져 있으면 null(프론트는 이름 없는 녹음을 튼다). 로그인·가입 응답과 /auth/me 가 같이 내준다 */
  greet(kind: Greeting, nickname: string) {
    return this.register(greetingText(kind, nickname));
  }

  /** mp3 — DB 에 있으면 그걸, 없으면 올려 둔 대사로 만든다. 모르는 id·꺼짐·실패는 null */
  async audio(id: string): Promise<Buffer | null> {
    if (!this.enabled || !/^[0-9a-f]{16}$/.test(id)) return null;
    const kept = await this.prisma.voiceClip.findUnique({ where: { id }, select: { audio: true } });
    if (kept) return Buffer.from(kept.audio);
    const en = this.lines.get(id);
    if (!en) return null;
    let p = this.making.get(id);
    if (!p) {
      p = this.make(id, en).finally(() => this.making.delete(id));
      this.making.set(id, p);
    }
    return p;
  }

  private async make(id: string, text: string): Promise<Buffer | null> {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': this.key!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: this.model, voice_settings: JSON.parse(SETTINGS) }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        this.log.warn(`ElevenLabs ${res.status} ${(await res.text()).slice(0, 200)}`); // 401 키·402/429 크레딧
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      // 저장이 실패해도 이번 소리는 준다 — 다음 요청이 다시 만든다
      await this.prisma.voiceClip.upsert({ where: { id }, create: { id, text, audio: buf }, update: {} }).catch((e) => this.log.warn(`음성 저장 실패: ${e}`));
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
  @Header('Cache-Control', 'public, max-age=31536000, immutable') // id 가 대사·설정의 해시라 내용이 안 바뀐다 — 자막 분석·재생 두 번 받는 걸 한 번으로
  @ApiOperation({ summary: '신의 한마디 영어 음성(mp3) — id 는 /recommend 응답의 line.voice. ELEVENLABS_ENABLED 가 꺼져 있으면 404' })
  async get(@Param('id') id: string) {
    const buf = await this.voice.audio(id);
    if (!buf) throw new NotFoundException('목소리가 안 나오네');
    return new StreamableFile(buf, { type: 'audio/mpeg' });
  }
}

@Module({ controllers: [VoiceController], providers: [VoiceService], exports: [VoiceService] })
export class VoiceModule {}
