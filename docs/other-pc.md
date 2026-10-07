# 다른 PC(다른 망)에서 할 일

회사 PC 망에서 막혀 못 한 일. 집·학교 PC 에서 이 문서대로 한다. 끝낸 항목은 지우고 `CONTEXT.md` "한 일"에 한 줄로 옮긴다.

## 준비 (공통)

```
git pull
cd backend && npm install && npx prisma generate
cd ../frontend && npm install
```

`backend/.env` 가 있어야 한다(`DATABASE_URL` = Neon direct 주소 — `CONTEXT.md` "다른 PC 에서 이어 하기"). DB 는 배포와 같은 것이다.

## 1. 영어 제목으로 들어간 한국 곡을 한글 제목으로 (10/7 베타 D-9)

**증상**: "항해"가 "Beautiful Sailing"으로 나온다. 곡을 모을 때 한국 iTunes 스토어가 0건을 줘서 미국 스토어 표기로 들어갔다.
**회사 PC 에서 못 한 까닭**: 그 망은 한국 스토어 검색이 늘 0건이다(10/7 다시 확인).

먼저 이 망이 되는지 본다 — 곡이 나오면 된다.

```
curl "https://itunes.apple.com/search?term=잔나비&country=kr&entity=song&limit=1"
```

1. **후보 찾기(읽기만, DB 안 바꿈)** — `backend` 에서

   ```
   node scripts/titles.mjs find
   ```

   한글 가수 + 영어 제목인 곡을 한국 스토어에서 찾아 `backend/.titles.json` 에 쓴다. 곡당 3초라 수백 곡이면 10~20분.
   같은 곡인지는 곡 번호로 맞춘다(한국 스토어 곡을 미국 스토어에서 조회해 영어 제목이 같을 때만).
2. **후보를 눈으로 본다** — 화면에 `가수 - 영어 제목 → 한글 제목` 이 찍힌다. 엉뚱한 짝이 있으면 `.titles.json` 에서 그 줄의 `ko` 를 `null` 로 바꾼다.
   원래 영어 제목인 곡(TOMBOY, Everything 등)은 "(한글 제목 없음)"으로 나오고 안 바뀐다.
   **공용 DB 를 바꾸는 일이라 후보 목록을 사용자에게 보여 주고 확인받은 뒤 3번으로 간다**(CLAUDE.md 강한 규칙).
3. **적용**

   ```
   node scripts/titles.mjs apply
   ```

   `Track.title` 을 바꾸고 평가 정답표 `backend/src/recommend/eval.json` 의 "가수 - 제목"도 같이 바꾼다. Gemini 는 안 쓴다(곡 설명·벡터는 그대로).
4. **확인**
   - `git diff backend/src/recommend/eval.json` — 바뀐 줄이 후보와 맞나
   - `npm test`
   - 배포 사이트에서 "엔시티" 편지 → "항해"로 나오나(서버가 곡 목록을 다시 읽는 데 1분쯤)
5. **커밋** — `eval.json` 만. `.titles.json` 은 커밋하지 않는다(git 무시).
   `[FIX] 영어 제목으로 들어간 한국 곡을 한글 제목으로 — 한국 스토어 표기 N곡`

**알아 둘 것**
- 편지별 기록(`LetterLine.tracks`)·검색 기록(`SearchLog.tracks`)의 옛 영어 제목은 그대로 남는다. 같은 편지를 3일 안에 다시 부칠 때 "전에 보여 준 곡 뒤로" 가 그 곡에 한 번 안 먹는다 — 그뿐이다.
- 곡 제목 글자 일치 가산(`score.ts lexical`)이 한글 제목에 걸리게 된다. 순위가 조금 바뀔 수 있다 — 적용 뒤 `npm run eval -- rerank`(캐시로 도는 싼 평가)로 전·후를 본다.
- 한국 스토어에 없는 곡은 못 바꾼다.

## 2. 실제 폰으로 볼 것 (망과 무관, 폰이 있어야 함)

10/7 베타 응답자 4명이 전원 폰, 3명이 인스타그램 안 브라우저였다. 지금까지 확인은 PC 와 헤드리스 폰 흉내뿐이다.
- 안드로이드 크롬·삼성 인터넷·인스타 안 브라우저: 디스크를 탭하면 재생되나(던져지지 않나 — 10/7 고침), 옆으로 넘기면 바로 재생되나
- 30초가 끝나면 다음 곡으로 넘어가며 LP 판 소리가 나나. 소리 크기·길이가 괜찮나(`frontend/lib/vinyl.ts`)
- 하트를 누르면 남나(새로 고쳐도)
