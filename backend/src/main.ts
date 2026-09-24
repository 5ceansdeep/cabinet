import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 프론트(:3000)에서 부른다
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
  // DTO 에 없는 값은 버리고, 규칙에 맞지 않으면 400
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  /* API 문서 — http://localhost:4000/docs (Authorize 버튼에 JWT 를 넣으면 /auth/me 도 눌러볼 수 있다) */
  const config = new DocumentBuilder()
    .setTitle('cabinet API')
    .setDescription('자연어로 적은 상황에 맞는 음악을 서류함에서 건져 올리는 서비스')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
