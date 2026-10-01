# 다음 할 일 (2026-10-01 기준)

급한 순. 끝낸 항목은 지우고 CONTEXT.md "10/1 한 일" 처럼 한 줄로 옮긴다.

## 1. 요청 프롬프트 평가 — 프롬프트 탓인지 모델 탓인지

10/1 요청 풀어 쓰기 프롬프트를 요청 종류별로 바꿨다(cd6b632, 배포됨). 243곡 평가:

| 프롬프트 | 해석 모델 | 하나라도 맞음 · 재현율 |
|---|---|---|
| 옛 | 3.5-flash-lite | 32/39 · 42% |
| 새 | 예비 모델(Lite 한도가 차서) | 28/39 · 36% |
| 새 | 3.5-flash-lite | ? — 오후 4시(태평양 자정) 뒤 |

- `cd backend; Remove-Item .eval-cache.json; npm run eval` — 로그에 "3.5-flash-lite 오늘 한도 다 씀" 이 없어야 Lite 로 잰 것
- 새+Lite 가 32/39·42% 근처 → 모델 탓. 프롬프트는 두고 예비 모델 순서(`gemini.ts SPARE`)를 다시 본다
- 새+Lite 도 낮다 → 프롬프트 탓. 예비 모델 결과에선 "나만 뒤처진 것 같아"·"생각이 너무 많아서" 가 모래성·한숨·밤편지로 몰렸다 — "지침 → 조용한 위로" 규칙 의심
- 비교용 캐시: 루트 `eval-cache.old.json`(옛) · `eval-cache.fallback.json`(새+예비) — 끝나면 지우고 새 `.eval-cache.json` 커밋

## 2. 곡 설명 다시 쓰기

설명이 "밤·혼자·아련함·잔잔함" 으로 비슷해 우울한 요청마다 같은 곡이 끼어든다. 가사를 못 찾던 곡은 "가사 없는 연주곡" 거짓말(바나나쉐이크·Peanut butter Sandwich·pasta24).
"배고파" 에 밤양갱이 안 나오는 것도 이것 — 지금 설명엔 음식 얘기가 없다.

- 새 프롬프트는 `feat/describe-prompt`(뻔한 낱말 금지, 좋은/나쁜 예, 춤·BPM). 두 곡 시험 — 밤양갱이 "달디단 밤양갱 하나면 충분했다는 비유" 로
- 순서: 1번 끝 → 브랜치를 main 위로 → 공용 DB 의 `describedAt` 전부 비우기(설명·임베딩은 남아 추천은 계속 된다) → `POST /catalog/describe` → `npm run eval`
- 275곡이면 Gemini 한도가 하루에 모자랄 수 있다 — 3.8-flash 20 · 그다음 예비 모델들
- 새로 넣은 32곡(배고파·재즈)은 설명이 없어 아직 추천에 안 나온다. 배포 서버 새벽 배치(한국 오후 3시)가 옛 프롬프트로 채울 수 있는데, 어차피 다시 쓴다
- 가사를 끝내 못 찾는 곡(모래성 등)은 제목에서 짐작한 걸 단정해 쓴다 — 다시 쓴 뒤 몇 곡 보고 판단

## 3. 베타 배포 마무리 — 프론트(Vercel)와 연결

백엔드는 떴다: **https://cabinet-production-9cf8.up.railway.app** (Railway, 싱가포르). `main` 푸시마다 자동 배포.

1. **Vercel** — vercel.com → Continue with GitHub → Add New → Project → `cabinet` Import
   - Root Directory `frontend`, 환경변수 `NEXT_PUBLIC_API_URL` = `https://cabinet-production-9cf8.up.railway.app` (끝에 `/` 없이) → Deploy
2. **CORS 연결** — Railway Variables 에 `WEB_ORIGIN` = Vercel 주소(끝에 `/` 없이). 안 하면 브라우저가 백엔드 호출을 막는다
3. **한 바퀴 확인** — 회원가입 → 편지(장르 칩) → 결과(디스크·신의 한마디·이유·미리듣기·던지기) → 서랍에 넣기 → 보관함. Claude 가 헤드리스로(`/visual-check`)
4. **테스터 안내문** — PC 전용, Gemini 무료 한도라 입력한 글이 Google 모델 개선에 쓰일 수 있음, 비밀번호 찾기 없음
5. Railway 체험 크레딧(30일·$5) 끝나기 전에 Hobby 로

알고 갈 것: 위험한 백엔드 변경은 브랜치에서. 곡 풀 넓히기(`POST /catalog/grow`)가 도는 동안 main 푸시 금지(재배포되면 끊긴다).
Railway 디스크는 배포마다 새로 — `.yt-budget.json`·`.voice-cache/` 가 비워진다.

## 4. ElevenLabs 목소리

코드는 다 됐다(`ELEVENLABS_ENABLED`·`ELEVENLABS_MODEL`, 음성 캐시). **무료 등급은 API 로 보이스 라이브러리 목소리를 못 쓴다(402)** — 유료 Starter / 기본 목소리로 바꾸고 고정 대사도 다시 녹음 / 베타 동안 끄기.
새로 쓴 고정 대사 3개(RESULT_EMPTY·RESULT_DRY·RESULT_FAILED, `docs/voice-script.csv`)는 어느 쪽이든 녹음 필요.

## 5. 영어 제목으로 들어간 한국 곡 110곡

새로 수집하는 곡은 한글 제목을 먼저 쓰게 고쳤다(10/1). 기존 110곡("A Thought on an Autumn Night" 등)은 남았다.
한국 스토어 곡 번호 → 미국 스토어 조회로 같은 곡인지 확인하고 한글 제목으로 바꾸는 스크립트를 만들어 둠(10/1 세션 scratchpad `titles.tmp.mjs` — 읽기만).
10/1 은 한국 스토어가 110곡 전부 0건(간헐 장애)이라 못 했다. 바꿀 목록을 보여 주고 DB 수정.

## 6. 잔일

- `backend/package-lock.json`·`frontend/package-lock.json` — npm 이 다시 쓴 것(기능 차이 없음). 커밋할지 사용자 답 대기
- 장르 칩 — 요청문에서 장르를 뽑게 됐다(10/1). 칩은 Gemini 가 막혀도 확실히 걸리고 고를 수 있는 장르가 보여서 일단 유지. 뺄지 사용자 고민 중
- 관리자 비밀번호 바꾸기(대화에 노출됨). 비밀번호 바꾸기·찾기 API 는 없다
- 재정렬 한 줄 이유가 6곡 중 일부 빠질 때가 있다(Lite 모델이 지시를 무시)
- 인스타 스토리 재생목록 카드(CONTEXT "바이럴 인증물") — 베타 뒤
