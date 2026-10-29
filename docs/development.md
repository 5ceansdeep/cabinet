# cabinet 개발 문서

상황이나 기분을 편지로 적으면, "신의 서류함"에서 어울리는 음악 10곡을 건져 올려 주는 웹 서비스. 졸업작품이고, 지금은 비공개 베타(10/2~)를 돌리는 중이다.

- 서비스: https://cabinet-flame-zeta.vercel.app (Vercel) · API: https://cabinet-production-9cf8.up.railway.app (Railway)
- `main` 에 푸시하면 프론트·백엔드가 자동 배포된다. 마이그레이션도 그때 돈다.

## 무엇을 하나

1. **편지** — "친구들이랑 드라이브", "월요일 아침 출근길 힘내야 해"처럼 문장 그대로 적는다. 가수·장르·곡을 말해도 된다("빈지노 같은 힙합", "재즈 힙합").
2. **10곡** — 둘러선 3D 서류함 방에서 플로피 디스크 10장이 나온다. 가운데 온 디스크는 드라이브에 꽂혀 30초 미리듣기가 나오고, 끝나면 다음 곡으로 이어진다. 위쪽에 자막으로 "신의 한마디"가 뜨고 영어 음성으로도 읽어 준다.
3. **고르기** — 별로인 곡은 위로 던진다. "던진 곡 채우기"는 던진 만큼만, "다른 곡으로 다시 찾기"는 10곡을 통째로 새로 받는다. 마음에 드는 곡은 하트(좋아요)를 눌러 두면 그 사람의 다음 추천이 그쪽으로 조금 기운다.
4. **담기** — "N곡 모두 서랍에 넣기"를 누르면 영수증 모양 공유 카드(1080×1920)가 인쇄돼 나온다. 사진 저장, 링크·QR 공유. 공유 링크(`/s/:id`)는 카톡 미리보기에 카드가 뜨고, 열면 곡·미리듣기·유튜브 이어 듣기가 있다.
5. **이어 듣기** — 보관함(`/archive`)에서 서랍을 열면 유튜브 재생목록으로 이어 듣는다.

PC 와 휴대폰(세로 화면, 옆으로 밀어 넘기기) 모두 된다. 화면은 PC 에서 2.39:1 영화 비율 프레임 안에 뜬다.

## 화면

| 경로 | 설명 |
|---|---|
| `/` `/signup` `/forgot` `/reset` | 3D 서류함 서랍에서 서류가 한 장씩 날아와 입력. 이메일 하나로 가입/로그인을 가른다. 영어 음성 + 한국어 자막 |
| `/search` | 흰 편지지에 편지 쓰기 |
| `/results` | 곡 찾는 동안 벽 서랍이 탁탁 뒤져지고, 정면 서랍에서 디스크가 솟아오른다. 곡 목록·재생 카드·하트·서랍에 넣기 |
| `/archive` | 내 서랍. 디스크를 누르면 곡 카드, 서랍마다 공유 카드·유튜브 이어 듣기 |
| `/s/[id]` | 공개 서랍(로그인 없이). 카톡 미리보기 이미지 포함 |
| `/api/share` `/api/share/[id]` | 공유 카드 PNG 를 그린다(next/og) |
| `/report/[id]` | 곡 보고서 — 꺼 둠(`notFound`) |

## 추천이 도는 방식

```
편지 ─ Gemini 가 곡 설명과 같은 틀로 풀어 씀 + 임베딩(768차원)
     ─ 1단계: 곡 전체를 점수로 줄세워 후보 30곡
              score = 0.5 × 뜻(임베딩 코사인) + 0.5 × 소리(에너지·밝기 거리)
                      + 글자 일치 + 가수·곡·보컬 가산 + 취향(좋아요) 가산 − 던진 곡·허브 감점
     ─ 2단계: Gemini 가 후보 30곡의 설명을 읽고 순서를 다시 매김 + 신의 한마디
     ─ 후처리: 말한 가수 곡·제목 일치 곡 앞으로, 같은 편지로 본 곡은 뒤로 → 10곡
```

- 곡 풀은 설명과 임베딩이 붙은 약 900곡이다. 설명이 없는 곡은 아직 후보가 아니다.
- 재정렬이 6초를 넘기거나 실패하면 1단계 순서 그대로 나간다. Gemini 한도에 막혀도 서비스는 선다.
- 가수·곡이 곡 풀에 없으면 화면이 알리고(곡이 없어서인지 추천이 틀린 건지 알게), 3분 반 뒤 그 가수와 비슷한 곡을 곡 풀에 몰래 채운다.
- 설계와 개선 기록: [docs/recommend-plan.md](recommend-plan.md)(설계), [docs/recommend-journey.md](recommend-journey.md)(시도와 되돌린 시도). 평가는 `backend/src/recommend/eval.json` 의 45개 요청으로 `npm run eval`(아래).

## 구조

```
frontend/   Next.js 16 (App Router) + TypeScript + Tailwind 4 + React Three Fiber
backend/    NestJS 12 + Prisma 7 (Postgres — Neon) + Gemini
docs/       명세·설계·베타 안내문·다른 PC 에서 할 일
```

`app/` 은 라우트와 페이지 상태 흐름만, UI 조각은 `components/<화면>/`, 공용 유틸은 `lib/` 에 둔다. 3D 는 전부 R3F 이고 서류함 치수·재료는 `components/landing/` 에 모여 있다.

## 설정

DB 는 원격 Postgres(Neon) 하나를 모든 PC 와 배포가 같이 쓴다. **로컬에서 추천을 부르면 운영 `SearchLog` 에 남으니, 시험 편지는 끝나고 지운다.**

```bash
cd backend && npm install && npx prisma generate && npx prisma migrate deploy
cd frontend && npm install
```

`backend/.env.example` 을 `backend/.env` 로 복사해 채운다. `.env` 는 커밋하지 않는다.

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | 필수. Neon **direct** 주소(Connection pooling 끄고 복사, 호스트에 `-pooler` 없는 것) |
| `JWT_SECRET` | 필수. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. 배포 서버엔 로컬과 다른 값 |
| `GEMINI_API_KEY` | 필수. 요청 해석·재정렬·곡 설명·임베딩. 유료 등급이 아니면 Flash 계열만 된다 |
| `WEB_ORIGIN` | 프론트 주소(CORS, 비밀번호 재설정 링크). 하나만, 끝에 `/` 없이 |
| `ADMIN_EMAILS` | 곡 수집·배치를 부를 수 있는 이메일, 쉼표 구분 |
| `LASTFM_API_KEY`, `LASTFM_SHARED_SECRET` | 곡 태그, 비슷한 가수·곡 |
| `YOUTUBE_API_KEY`, `YT_SEARCH_DAILY_LIMIT` | 영상 ID 검색, 하루 상한(기본 60) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | 비밀번호 재설정 메일. 비우면 메일 대신 서버 로그에 링크를 찍는다 |
| `ELEVENLABS_ENABLED`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | 영어 음성. `true` 인데 키가 없으면 서버가 안 켜진다. `ELEVENLABS_MODEL` 은 넣지 않는다(기본 eleven_v3, 엉뚱한 값이면 음성이 전부 실패한다) |
| `DESCRIBE_NIGHTLY` | `true` 일 때만 새벽에 곡 설명을 자동으로 붙인다(Gemini 비용이 든다) |
| `PORT` | 기본 4000. Railway 는 알아서 넣는다 |

프론트는 `NEXT_PUBLIC_API_URL`(기본 `http://localhost:4000`)로 백엔드를 찾는다.

## 개발

```bash
npm run dev                      # 프론트(:3000) + 백엔드(:4000) + Prisma Studio(:5555)

cd frontend && npx tsc --noEmit -p . && npx eslint components app lib
cd backend  && npx tsc --noEmit -p tsconfig.json && npm run lint && npm test
cd backend  && npm run eval              # 평가 45개, 캐시된 해석을 쓰면 Gemini 를 안 부른다
cd backend  && npm run eval -- rerank    # 재정렬까지(재정렬 캐시가 있으면 이것도 싸다)
cd backend  && npm run voice             # 고정 대사 mp3 녹음(없는 것만, ElevenLabs 크레딧)
```

- Swagger: http://localhost:4000/docs (Authorize 에 토큰)
- 끌 때 세 포트(3000·4000·5555)가 다 비었는지 확인한다. 옛 백엔드가 남아 옛 코드가 응답한 적이 있다.
- 백엔드가 꺼져 있으면 로컬 개발에서만 프론트가 가짜 곡 12곡으로 돈다. 배포에선 못 닿으면 "다시 찾기"가 뜬다.
- **공용 DB 를 통째로 다시 쓰는 배치**(곡 설명·임베딩 다시 쓰기, 전 곡 재분석)는 표본 수십 곡으로 먼저 돌리고, 전·후 평가 숫자를 보여 준 뒤에만 전체를 돌린다.

## 백엔드 API

| 경로 | 설명 |
|---|---|
| `POST /auth/signup` `/login` `/check-email` `/forgot` `/reset`, `GET /auth/me` | 인증. bcrypt, JWT 7일, 로그인 5회 실패 15분 잠금. 가입 여부는 흘리지 않는다 |
| `GET /recommend?q=&seen=&thrown=&g=` | 편지 → 10곡 + 신의 한마디(+ 음성 id) + 곡이 모자랄 때 안내. 로그인했으면 좋아요 취향이 반영된다. IP 당 분당 10·하루 200 |
| `GET /recommend/line` · `/recommend/:id` | 한마디만 따로 · 곡 하나를 편지에 대 본 점수 |
| `POST /recommend/throw` | 던진 곡 기록(자주 던져진 곡은 순위가 조금 내려간다) |
| `GET /voice/:id` | 신의 한마디 영어 음성(DB 에 저장한 mp3) |
| `GET/POST /likes` | 좋아요 목록·누르기/취소 (JWT) |
| `GET/POST/DELETE /shelves` · `POST /shelves/:id/playlist` | 서랍(저장한 목록)과 유튜브 재생목록 링크 (JWT) |
| `GET /shelves/public/:id` | 공개 서랍(로그인 없이) |
| `POST /events` | 재생·끝까지 들음·좋아요·저장·공유·유튜브 이동 기록(사용자·IP 는 안 남긴다) |
| `GET /catalog/tracks` `/budget`, `POST /catalog/collect` | 곡 목록·유튜브 사용량·한 곡 수집 (수집은 관리자) |
| `POST/GET /catalog/grow` `/refill` | 곡 풀 넓히기(관리자, Gemini 안 씀). 매일 새벽 4시 자동 |
| `POST/GET /catalog/sound` | 소리 숫자(ReccoBeats) 채우기(관리자). 새벽 5시 자동 |
| `POST/GET /catalog/describe` | 곡 설명·임베딩(가사 LRCLIB + Gemini) 채우기(관리자). `DESCRIBE_NIGHTLY=true` 일 때만 새벽 6시 자동 |

곡 데이터 출처: iTunes(커버·30초 미리듣기·장르), Last.fm(태그·비슷한 가수·곡), ReccoBeats(에너지·밝기 등 소리 숫자), LRCLIB(가사 — 설명을 쓸 때만 보고 저장하지 않는다), Gemini(곡 설명·편지 해석·임베딩·재정렬), MusicBrainz(한국 가수의 한글·로마자 이름), YouTube(영상 ID — 필요할 때 + 태평양 23:30 밤 배치).

## 데이터

주요 표: `User` · `Shelf`/`ShelfTrack`(서랍) · `Track`(곡, 설명·임베딩·소리 숫자·가수 다른 표기) · `Like` · `SearchLog`(편지 글·나온 곡·한마디) · `LetterLine`(편지별 한마디와 꺼내 준 곡 전부) · `ThrowLog` · `EventLog` · `VoiceClip`.
베타 로그에는 편지 글과 나온 곡이 남지만 사용자·IP 는 남기지 않는다(안내문에 고지, [docs/beta-guide.md](beta-guide.md)).

## 문서

| 문서 | 내용 |
|---|---|
| [docs/ui-ux-spec.md](ui-ux-spec.md) | 화면 구성·연출 명세. 화면을 바꾸면 같이 고친다 |
| [docs/voice-persona.md](voice-persona.md) · [voice-script.csv](voice-script.csv) | 자막·음성 말투(브루스 올마이티의 신), 고정 대사 대본 |
| [docs/recommend-plan.md](recommend-plan.md) · [recommend-journey.md](recommend-journey.md) | 추천 설계, 개선 기록 |
| [docs/deploy.md](deploy.md) | Vercel·Railway·Neon 배포 절차 |
| [docs/beta-guide.md](beta-guide.md) | 베타 테스터 안내문 |
| [docs/mobile-plan.md](mobile-plan.md) · [youtube-playlist-plan.md](youtube-playlist-plan.md) | 모바일 대응, 유튜브 재생목록, 보고서(꺼 둠) 설계 |

## 기여

커밋은 `[TAG] 한국어 요약 — 부연` 형식(`FEAT`·`FIX`·`DOCS`·`REFACTOR`·`PERF`·`CLEAN`·`REDESIGN`·`CHORE`·`STYLE`·`MERGE`), 기능별로 나눠서. 강제 푸시와 `.env`·`*.db` 커밋은 훅이 막는다.

## 스택

- **frontend**: Next.js 16, React 19, React Three Fiber / drei, Tailwind 4, zustand, Phosphor Icons, next/og(공유 카드), qrcode
- **backend**: NestJS 12, Prisma 7(`@prisma/adapter-pg`), JWT(passport), nodemailer, vitest, oxlint
- **외부**: Gemini, ElevenLabs, Last.fm, iTunes, ReccoBeats, LRCLIB, MusicBrainz, YouTube Data API
- **배포**: Vercel(프론트) · Railway(백엔드, 항상 켜짐) · Neon(Postgres)
