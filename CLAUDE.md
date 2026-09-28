# cabinet

자연어로 적은 상황에 맞는 음악을 "신의 서류함"에서 건져 올려 주는 웹. 프론트 Next.js + R3F(`frontend/`), 백엔드 NestJS + Prisma(`backend/`).

- 루트에서 `npm run dev` → 프론트 :3000 + 백엔드 :4000.
- 세션 시작 시 루트 `CONTEXT.md` 를 읽고 이전 작업 상태를 이어간다. 작업을 마칠 때 갱신한다.
- 화면 명세는 `docs/ui-ux-spec.md`, 화면 글 말투는 `docs/voice-persona.md`.

## 응답 스타일
답변은 한국어, 조사·수식어를 줄인 짧은 케이브맨 말투. 코드·파일 경로·명령어는 그대로 둔다.

## 절대 규칙 (훅이 강제 — `.claude/hooks/`)
- `.env`, `*.db` 는 고치지도 커밋하지도 않는다. 예시 값은 `.env.example` 에.
- 커밋에 클로드 서명(Co-Authored-By 등)을 넣지 않는다. 작성자는 이 저장소의 로컬 git 설정.
- 강제 푸시(`--force`, `-f`) 금지.
- 검증용 도구(puppeteer-core 등)를 package.json 에 남겨 커밋하지 않는다.

## 커밋
DRIFT 형식 `[TAG] 한국어 요약 — 부연`, 기능별로 나눠 커밋. 상세는 `.claude/rules/commits.md`.
