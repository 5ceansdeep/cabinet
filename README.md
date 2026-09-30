# cabinet

자연어로 상황과 감정을 적으면, "신의 서류함"에서 그에 맞는 음악을 건져 올려 주는 웹 앱.

- 화면 명세: [docs/ui-ux-spec.md](docs/ui-ux-spec.md) — 화면 구성·연출은 전부 이 문서 기준
- 화면 글 말투: [docs/voice-persona.md](docs/voice-persona.md), 음성 대본 [docs/voice-script.csv](docs/voice-script.csv)
- 추천 개편 설계: [docs/recommend-plan.md](docs/recommend-plan.md)
- 유튜브 재생목록: [docs/youtube-playlist-plan.md](docs/youtube-playlist-plan.md)
- 작업 상태: [CONTEXT.md](CONTEXT.md)

## 화면

1. **로그인·회원가입** (`/`, `/signup`, `/forgot`) — 3D 서류함 서랍에서 서류가 한 장씩 날아와 입력. 영어 음성 + 한국어 자막
2. **로딩** — 서랍 쾅 닫힘 → 후광 + 성가
3. **편지 쓰기** (`/search`) — 흰 편지지에 요청문
4. **결과** (`/results`) — 둘러선 서류함 방에 플로피 디스크. 클릭 = 드라이브에 꽂혀 30초 미리듣기, 위로 뿌리거나 꾹 누르면 던져 버림, "서랍에 넣기"로 저장
5. **보관함** (`/archive`) — 내 서랍 목록. 서랍 열면 "유튜브에서 이어 듣기"

모든 화면은 2.39:1 영화 비율 프레임 안에 뜬다.

## 구조

```
frontend/   Next.js (App Router) + TypeScript + Tailwind + React Three Fiber
backend/    NestJS + Prisma (Postgres — Neon)
docs/       스펙·설계 문서
```

## 설정

DB 는 원격 Postgres(Neon) 하나를 모든 PC 가 같이 쓴다. `backend/.env.example` 을 `backend/.env` 로 복사해 채운다.

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | Neon **direct** 주소 (Connect → Connection pooling 끄고 복사, 호스트에 `-pooler` 없는 것). 없으면 서버 안 켜짐 |
| `JWT_SECRET` | 필수. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` — 배포 서버엔 다른 값 |
| `ADMIN_EMAILS` | 곡 수집·배치를 부를 수 있는 이메일, 쉼표 구분 |
| `LASTFM_API_KEY`, `LASTFM_SHARED_SECRET` | 곡 태그 |
| `YOUTUBE_API_KEY`, `YT_SEARCH_DAILY_LIMIT` | 영상 ID 검색, 하루 상한 (기본 60) |
| `GEMINI_API_KEY` | 필수. 곡 설명·요청 풀어 쓰기·임베딩 (aistudio.google.com, 무료 한도는 Flash 만) |
| `PORT` | 기본 4000 |

```bash
cd backend && npm install && npx prisma migrate deploy
cd frontend && npm install
```

## 개발

```bash
npm run dev                      # 프론트(:3000) + 백엔드(:4000) 한 번에

cd frontend && npm run dev       # 프론트만
cd backend && npm run start:dev  # 백엔드만

cd backend && npm test           # vitest
cd backend && npm run lint       # oxlint
cd backend && npx prisma studio  # DB 보기 (또는 Neon 콘솔 Tables)
```

- Swagger: http://localhost:4000/docs
- 백엔드가 꺼져 있으면 프론트는 가짜 곡 12곡·브라우저 저장으로 돈다.

## 백엔드 API

| 경로 | 설명 |
|---|---|
| `POST /auth/signup` · `/auth/login` · `GET /auth/me` · `POST /auth/check-email` | 인증 (bcrypt, JWT 7일, 로그인 5회 실패 15분 잠금) |
| `GET /recommend?q=&seen=&thrown=` | 요청문 → Gemini 가 곡 설명 틀로 풀어 씀 → 뜻(임베딩 코사인) + 소리(에너지·밝기 거리). 가수당 한 곡 먼저 |
| `GET /recommend/:id` | 곡 하나를 요청문에 대 본 점수 |
| `GET/POST/DELETE /shelves` | 서랍(저장한 목록), JWT 필요 |
| `POST /shelves/:id/playlist` | 유튜브 `watch_videos` 재생목록 링크 + 못 찾은 곡 검색 링크 |
| `GET /catalog/tracks` · `POST /catalog/collect` · `GET /catalog/budget` | 곡 목록·수집(관리자)·유튜브 사용량 |
| `POST/GET /catalog/grow` | 곡 풀 넓히기 배치(관리자). 매일 새벽 4시 자동 |
| `POST/GET /catalog/sound` | 소리 숫자(ReccoBeats) 채우기(관리자). 매일 새벽 5시 자동 |
| `POST/GET /catalog/describe` | 곡 설명·임베딩(가사 LRCLIB + Gemini) 채우기(관리자). 매일 새벽 6시 자동 |

곡 데이터 출처: iTunes(커버·30초 미리듣기·장르), Last.fm(태그), ReccoBeats(소리 숫자 — energy·valence 등), LRCLIB(가사 — 설명에만, 저장 안 함), Gemini(곡 설명·요청 해석·임베딩), MusicBrainz(한국 가수 한글 이름), YouTube(영상 ID — 필요할 때 + 태평양 23:30 밤 배치).

## 스택

- **frontend**: Next.js, React Three Fiber / drei / postprocessing, zustand, Tailwind
- **backend**: NestJS, Prisma 7 (`@prisma/adapter-pg`), JWT, vitest, oxlint
