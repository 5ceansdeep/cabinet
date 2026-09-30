# 다음 할 일 (2026-09-30 밤 기준)

급한 순. 끝낸 항목은 지우고 CONTEXT.md "9/30 한 일" 처럼 한 줄로 옮긴다.

## 1. 베타 배포 마무리 — 프론트(Vercel)와 연결

백엔드는 떴다: **https://cabinet-production-9cf8.up.railway.app** (Railway, 싱가포르, Online).
9/30 점검 — `/` 200, `/docs` 열림, `/recommend?q=안녕` 곡 돌려줌(2.8초), 토큰 없이 `/shelves`·`POST /catalog/grow` 401, `/voice/:id` 404(음성 꺼 둠).

남은 순서 (가입·클릭은 사용자, 점검은 Claude):

1. **Vercel** — vercel.com → Continue with GitHub → Add New → Project → `cabinet` Import
   - Root Directory `frontend`, 환경변수 `NEXT_PUBLIC_API_URL` = `https://cabinet-production-9cf8.up.railway.app` (끝에 `/` 없이) → Deploy
2. **CORS 연결** — Railway Variables 에 `WEB_ORIGIN` = Vercel 주소(끝에 `/` 없이) → Deploy.
   지금은 `http://localhost:3000` 만 허용이라, 이걸 안 하면 브라우저가 백엔드 호출을 막는다
3. **한 바퀴 확인** — 회원가입 → 편지(장르 칩) → 결과(디스크·신의 한마디·이유·미리듣기) → 서랍에 넣기 → 보관함 → 유튜브에서 이어 듣기.
   Claude 가 배포 주소로 헤드리스 확인(`/visual-check`)
4. **테스터 안내문** — PC 전용, Gemini 무료 한도라 입력한 글이 Google 모델 개선에 쓰일 수 있음, 비밀번호 찾기 메일 없음
5. Railway 체험 크레딧(30일·$5) 끝나기 전에 Hobby 로

배포 뒤 알고 갈 것: `main` 에 푸시하면 Railway·Vercel 이 자동으로 다시 배포한다. 개발 중 백엔드를 고치면 배포 서버도 바뀌니,
위험한 변경은 브랜치에서. Railway 디스크는 배포마다 새로 — `.yt-budget.json`·`.voice-cache/` 가 비워진다.

## 2. "보컬 없는 재즈" 같은 요청이 안 된다

9/30 "보컬이 들어가있지 않은 재즈"+재즈 → 6곡 중 Take Five 하나만 맞음. 원인 넷:

1. **곡 풀에 연주 재즈가 1곡뿐** — 재즈로 잡히는 13곡 대부분 보컬(쳇 베이커·시나트라·사데·샹송 가수)
   → 연주 재즈 모으기: `POST /catalog/grow {tags: ["cool jazz","bebop","jazz piano","bossa nova","hard bop"]}`
2. **"보컬 없음"을 점수에 담을 통로가 없다** — ReccoBeats 가 주는 instrumentalness 를 버리고 있다
   → Track 에 `instrumentalness` 칸, 소리 분석 다시(244곡 약 13분, 무료), 요청 풀어쓰기가 목표값도 뽑아 소리 점수(`score.ts soundScore`)에
3. **곡 설명이 가사 없는 노래를 "가사가 없는 연주곡"이라 쓴다** — 가사 데이터가 없을 뿐인데(Linus' Blanket "Labor in Vain").
   두루뭉술한 설명이 차분한 요청마다 끼어드는 것(평가 0점 요청들)도 같은 원인
   → 곡 설명 프롬프트(`catalog/describe.ts`): "가사 정보 없음 ≠ 연주곡", 연주곡 여부는 instrumentalness 숫자로.
   가사 없는 곡부터 다시 쓰기 — 3.8-flash 무료 하루 20곡이라 며칠
4. **장르 기준이 느슨하다** — 태그 가중치 10 이상이면 그 장르. 피아프·트레네·아즈나부르가 jazz 27~37 로 재즈에 잡힌다
   → `catalog/genres.ts MIN_WEIGHT` 를 30 쯤으로, 또는 그 곡의 상위 3개 태그 안에 있을 때만

끝나면 평가 다시(`cd backend && npm run eval`, 지금 32/39·46%) — 나빠졌으면 되돌린다.

## 3. ElevenLabs 목소리

코드는 다 됐다(`ELEVENLABS_ENABLED` 로 켜고 끔, `ELEVENLABS_MODEL` 로 모델 선택, 음성 파일 캐시).
**무료 등급은 API 로 보이스 라이브러리 목소리를 못 쓴다(402)** — 고르기:

- 유료 Starter 로 올리고 지금 목소리 그대로
- 기본(premade) 목소리로 바꾸고 고정 대사도 그 목소리로 다시 녹음
- 베타 동안은 끄기(기계 음성)

정해지면 두 모델(multilingual v2 / flash v2.5) 비교 음성을 뽑는다. 새로 쓴 고정 대사 3개(RESULT_EMPTY·RESULT_DRY·RESULT_FAILED,
`docs/voice-script.csv`)는 어느 쪽이든 녹음이 필요하다.

## 4. 잔일

- `backend/package-lock.json`·`frontend/package-lock.json` — 이 PC 에서 `npm install` 할 때 npm 이 다시 쓴 것(기능 차이 없음).
  backend 는 SQLite 시절 설치 부품 찌꺼기 23개 정리, frontend 는 npm 버전 차이 표시(`"peer": true`)와 선택 부품 2개. 커밋할지 사용자 답 대기
- 재정렬 한 줄 이유가 6곡 중 일부 빠질 때가 있다(Lite 모델이 지시를 무시) — 거슬리면 빠진 곡만 다시 묻거나 모델을 올린다
- 곡 제목 번역 표기(잔나비 "A Thought on an Autumn Night") 한글로 맞추기
- 인스타 스토리 재생목록 카드(CONTEXT "바이럴 인증물") — 베타 뒤
