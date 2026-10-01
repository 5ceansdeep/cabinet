import { setDefaultResultOrder } from 'node:dns';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

// IPv6 가 막힌 네트워크(회사망 등)에선 외부 API 연결이 10초 걸려 끊긴다 — IPv4 부터
setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 배포 서버(Railway)는 프록시 뒤 — 이게 없으면 모든 사용자 IP 가 프록시 하나로 보여 IP 당 제한(로그인 잠금·이메일 확인·던지기)을 다 같이 나눠 쓴다
  app.set('trust proxy', 1);

  // 프론트(:3000)에서 부른다
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
  // DTO 에 없는 값은 버리고, 규칙에 맞지 않으면 400
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  /* API 문서 — http://localhost:4000/docs (Authorize 버튼에 JWT 를 넣으면 /auth/me 도 눌러볼 수 있다) */
  const config = new DocumentBuilder()
    .setTitle('cabinet API')
    .setDescription('자연어로 적은 상황에 맞는 음악을 서류함에서 건져 올리는 서비스. [Gemini] = 부를 때마다 Gemini 하루 한도를 쓴다')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
