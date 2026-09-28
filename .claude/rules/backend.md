---
paths:
  - "backend/**"
---

# 백엔드 (NestJS + Prisma 7)

- 비밀값은 `config.getOrThrow()` 로 읽는다. 코드에 기본값을 적지 않는다 — 없으면 서버가 켜지지 않아야 한다.
- `.env` 에 새 키를 쓰면 `.env.example` 에도 설명과 함께 추가한다.
- JWT 모듈은 `JwtModule.registerAsync` (register() 면 .env 보다 먼저 평가돼 서명·검증 키가 어긋난다).
- Prisma 7: 스키마에 `url` 을 못 쓴다 — `prisma.config.ts` + 드라이버 어댑터. `.env` 도 자동으로 안 읽는다.
- 외부 API(MusicBrainz 초당 1회, 유튜브 하루 검색 상한)를 쓰는 엔드포인트는 관리자 전용(`ADMIN_EMAILS`)이고 요청 크기를 제한한다.
- DTO 는 문자열 최대 길이·배열 최대 개수를 둔다. `ValidationPipe({ whitelist: true })` 가 전역.
- 로그인 실패는 "계정 없음"과 "비밀번호 틀림"을 구분해 알리지 않는다.
