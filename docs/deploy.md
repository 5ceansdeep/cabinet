# 배포 — 비공개 베타 (2026-09-30)

프론트는 Vercel, 백엔드는 항상 켜져 있는 곳(Railway 등), DB 는 지금 쓰는 Neon 그대로. 모바일은 베타 범위 밖, Gemini 는 무료 한도.

**진행(9/30 밤)**: 백엔드 배포 완료 — https://cabinet-production-9cf8.up.railway.app (Railway, Southeast Asia). 프론트·CORS 연결은 [next.md](next.md) 1장.
Railway 에서 처음 빌드는 기본 설정(루트 폴더·변수 없음)으로 바로 돌아 실패하는 게 정상 — 설정·변수를 넣고 Deploy.
Region 은 서비스 Settings 에서 Southeast Asia(Singapore) 로 — Neon 이 싱가포르다(워크스페이스 설정의 기본 지역은 새 서비스에만).
Networking → Generate Domain 의 포트는 8080 그대로(Railway 가 넣는 `PORT`).

## 1. 백엔드 — Railway (월 $5 안팎)

항상 켜져 있어야 한다. 잠드는 무료 호스팅(Render 무료 등)이면 첫 요청이 30초 넘게 걸리고, 서버 안의 새벽 배치(곡 풀 4시·소리 5시·설명 6시, 영상 ID 태평양 23:30)가 돌지 않는다.

- 저장소 연결 → **Root Directory `backend`**
- Build: `npm ci && npx prisma generate && npm run build`
- Pre-deploy(릴리스): `npx prisma migrate deploy` — 스키마가 바뀐 배포에서만 실제로 뭔가 한다(Neon 에는 9/30 까지 전부 적용됨)
- Start: `npm run start:prod`
- 환경변수 (`.env` 파일 없이 여기에 넣는다 — `prisma.config.ts` 는 파일이 있을 때만 읽는다):

  | 키 | 값 |
  |---|---|
  | `DATABASE_URL` | Neon direct 주소 (로컬과 같은 DB) |
  | `JWT_SECRET` | **새로 만든다** — `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. 로컬 값 쓰지 않는다 |
  | `GEMINI_API_KEY` | AI Studio 키 |
  | `WEB_ORIGIN` | 프론트 주소 (예: `https://cabinet.vercel.app`) — CORS. 하나만 받는다 |
  | `ADMIN_EMAILS` | 관리자 이메일(쉼표) — 곡 수집·배치 엔드포인트 |
  | `LASTFM_API_KEY`, `LASTFM_SHARED_SECRET`, `YOUTUBE_API_KEY`, `YT_SEARCH_DAILY_LIMIT` | 로컬과 같은 값 |
  | `ELEVENLABS_ENABLED` | `false` (켜려면 `true` + `ELEVENLABS_API_KEY`·`ELEVENLABS_VOICE_ID`·`ELEVENLABS_MODEL`) — 무료 등급은 라이브러리 목소리를 API 로 못 쓴다(402) |
  | `PORT` | 넣지 않는다 — Railway 가 준다 |

- 확인: `https://<백엔드>/docs` 가 열리고 `GET /recommend?q=안녕` 이 곡을 돌려주면 된다.

## 2. 프론트 — Vercel (무료)

- 저장소 연결 → **Root Directory `frontend`**, 프레임워크 Next.js (빌드 명령은 기본값)
- 환경변수 `NEXT_PUBLIC_API_URL` = 백엔드 주소 (끝에 `/` 없이). 빌드 때 박히므로 바꾸면 다시 배포
- 도메인이 정해지면 백엔드 `WEB_ORIGIN` 을 그 주소로 맞춘다

## 3. 한 바퀴 확인

회원가입 → 편지 → 결과(신의 한마디·곡별 이유·미리듣기) → 서랍에 넣기 → 보관함 → 유튜브에서 이어 듣기.
헤드리스 확인은 `/visual-check` 스킬(주소만 배포 주소로).

## 4. 알고 가는 것

- **Gemini 무료 한도**: 요청 한 번에 2번(Lite, 하루 500번) → 하루 250 요청 안팎. 같은 문장은 서버 캐시(서버를 다시 켜면 빔).
  무료 한도에선 보낸 글이 Google 모델 개선에 쓰일 수 있다 — **테스터에게 미리 알린다**.
- 유튜브 하루 검색 수는 `.yt-budget.json` 파일에 센다 — 배포 서버에선 다시 배포할 때마다 0 으로 돌아간다(유튜브가 하루 상한은 따로 막아 준다).
- 비밀번호 찾기 메일은 안 나간다 — 테스터가 잊으면 관리자가 DB 에서 처리.
- 신의 음성은 기계 음성(ElevenLabs 는 꺼 둠), 세로(모바일) 화면은 맞춰 두지 않았다 — PC 로 안내.
- Railway 디스크는 배포마다 새로 — 그래서 신의 한마디 음성은 디스크가 아니라 DB(`VoiceClip`)에 둔다(10/4). 배포해도 같은 대사는 다시 안 만든다.
- 음성을 켜려면 Railway 에 `ELEVENLABS_ENABLED=true`·`ELEVENLABS_API_KEY`·`ELEVENLABS_VOICE_ID`. 목소리 설정은 `backend/voice-settings.json`.
- Apple 표지·미리듣기 출처 표시 조건은 공개 전에 확인.
