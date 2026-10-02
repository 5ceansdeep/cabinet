# cabinet 작업 컨텍스트 (2026-10-02 밤)

## 지금 어디까지
- **베타 진행 중**(10/2 첫 테스터 피드백 받음). 백엔드(Railway)·프론트(Vercel) 배포, `main` 푸시마다 자동 배포.
  프론트 https://cabinet-flame-zeta.vercel.app · 백엔드 https://cabinet-production-9cf8.up.railway.app · 안내문 [docs/beta-guide.md](docs/beta-guide.md)
- **추천**: 해석(Gemini — 핵심어형 풀어 쓰기 + 쓰임 장면 + words·alt·songs) → 1단계(임베딩 0.5 + 소리 0.5, 제목·핵심어 글자 가산) 후보 **30곡**
  → 재정렬(Gemini) → 제목 일치·꼽은 곡 맨 앞 고정 → 10곡. 가수 곡이 적으면 Last.fm 비슷한 가수, 곡을 꼽으면 Last.fm 비슷한 곡을 가산
- **곡 풀 604곡**(설명 있는 곡 기준). 평가(45개, 상위 5곡): 304곡 46% → 394곡 41% → 604곡 **33%** — 곡이 늘수록 떨어진다. 정답표가 곡 풀을 못 따라가는 탓이 큼
  (다음 할 일: Gemini 심사 채점)
- **음성은 다 꺼 둠**(`frontend/lib/voice.ts` `VOICE=false` — 자막만). 버튼·안내 글은 평범한 말투, 자막만 신(정체를 숨긴 관리인) 말투
- 남은 일은 [docs/next.md](docs/next.md) 에 급한 순

## 다른 PC 에서 이어 하기 (10/2 밤)
- **작업은 `main`**(배포와 같음, 열린 브랜치 없음). `git pull`, `backend`·`frontend` 에서 `npm install`, `cd backend && npx prisma generate`
- 루트 `npm run dev` = 프론트 3000 + 백엔드 4000 + Prisma Studio 5555. **끌 때 세 포트가 다 비었는지 확인**(10/2 옛 백엔드가 4000 에 남아 옛 코드가 응답했다)
- **로컬도 배포와 같은 Neon DB** — 로컬에서 추천을 부르면 `SearchLog`(편지·곡·한마디)에 남고 곡 풀 넓히기 씨앗이 된다. **시험 편지는 끝나고 지운다**
  (`delete from "SearchLog" where query = '...'`). 마이그레이션은 `npx prisma migrate deploy` 로 바로 적용해도 되고 `main` 푸시 때 Railway 도 돌린다
- **강한 규칙**(CLAUDE.md): DB 전체를 다시 쓰는 배치는 표본으로 먼저 재고 숫자를 보여 준 뒤 확인받고 돌린다
- `backend/.env`: `DATABASE_URL`(Neon direct), **`GEMINI_API_KEY`(유료 1 등급, AI Studio 월 한도 ₩4,000 — 10/2 기준 ₩2,881 씀)**, `ADMIN_EMAILS`, `WEB_ORIGIN`,
  `LASTFM_API_KEY`, `YOUTUBE_API_KEY`, ElevenLabs(ENABLED false), `GMAIL_USER`·`GMAIL_APP_PASSWORD`, **`DESCRIBE_NIGHTLY`(비우면 새벽 곡 설명 안 돎)**
- Railway Variables: `GMAIL_*`·`WEB_ORIGIN` 필요, `DESCRIBE_NIGHTLY` 는 없음(= 새벽 곡 설명 꺼짐). 체험 크레딧 10/2 기준 29일·$4.94 남음
- 회사 PC 망: IPv6 막힘(`setDefaultResultOrder('ipv4first')`), bash curl 로 한글 보내면 깨짐(node 로), PowerShell 5.1 은 `&&` 대신 `;`,
  LRCLIB·Google·Neon·Last.fm 이 가끔 끊긴다(재시도), **한국 iTunes 스토어 검색 0건**
- **서버 기록 보는 법**: Neon SQL Editor —
  `select "createdAt", query, tracks, line, asked from "SearchLog" where query <> '' order by "createdAt" desc limit 50;`
  Railway → 서비스 → Deployments → View Logs 에서 `Recommend` 로 거르면 `"편지" → 곡 / … | 한마디: …` 가 실시간으로

## 10/2 한 일 (전부 main·배포됨)
**베타 준비**
- 추천 API IP 당 분당 10·하루 200(`Limiter`), 행동 기록 `EventLog`(재생·끝까지·저장·공유·유튜브 + 재생엔 요청문), Vercel Web Analytics(스크립트 한 줄, Enable 함)
- **검색 기록 `SearchLog` 에 편지 글·나온 10곡·신의 한마디·편지에 쓴 가수(asked)** — Railway 로그에도 한 줄. 사용자·IP 는 안 남김(안내문에 고지)
- 안내문 완성본 [docs/beta-guide.md](docs/beta-guide.md)(구글 폼 주소 포함), 음성 전부 끔, 녹음 없는 대사는 자막만
- 등록 화면 없앰 — 이메일 하나로 가입 여부를 물어 로그인/가입(`/signup` 은 `/` 로)
- 편지지 장르 칩 뺌(편지에 장르를 쓰면 서버가 거른다), 버튼·안내 글 평범한 말투(`.claude/rules/ui.md`)
**추천**
- 글자 일치 가산(`words` — 제목 +0.1, [핵심어] +0.04) + 제목 일치 곡 맨 앞 고정(`pinTitled`, 미쳤어 → Crazy), 짧고 애매한 요청은 두 갈래 읽기(`alt`)
- 요청 풀어 쓰기에 쓰임 장면(드라마·예능 브금·밈·챌린지) — 41 → 46%. **곡 설명 쪽 쓰임은 표본 99곡에서 39% 로 나빠져 안 씀**
- 신의 한마디: 곡 소개 대신 상황 반응, 정체 숨긴 관리인(녹음 있던 대사 4개는 원래대로)
- 재정렬 후보 20 → 30곡(394곡: 37 → 41%, 604곡: 31 → 33%). 허브 누르기(CSLS)는 나빠져 버림
- **편지에 쓴 가수가 없거나 적으면**: 화면 안내("아직 ○○ 님 곡은 서류함에 없어요 — 결이 비슷한 △·□ 곡으로…") + Last.fm 비슷한 가수 곡 +0.08
  + 곡 풀 넓히기가 그 가수 인기곡을 먼저(`SearchLog.asked`). 박효신 10곡은 직접 넣음
- **곡을 꼽으면**(`songs`): 곡 풀에 있으면 맨 앞 + 그 곡 벡터 반반 섞기 + Last.fm 비슷한 곡 +0.1, 없으면 그 가수 곡 2곡 맨 앞 + 비슷한 가수, 화면 안내
- 평가 세트 29곡 추가(394곡 기준, Claude 판단·사용자 확인 전), 추천 개선 기록 [docs/recommend-journey.md](docs/recommend-journey.md)
**곡 풀**
- `POST /catalog/refill`(넓히기 → 소리, **Gemini 안 씀**, 500곡·태그 20개까지) / 곡 설명은 `POST /catalog/describe` 따로(곡당 Gemini 2번, 한도에 막혀도 다시 누르면 이어서)
- 새벽 곡 설명 자동 실행은 `DESCRIBE_NIGHTLY=true` 일 때만. 곡 풀 395 → 604곡(refill 로 외국 보컬·반대 결 태그)
**화면**
- 공유 카드·공개 서랍·카톡 미리보기 = **서류함 마트 영수증**(Anton 로고·감열지 플로피·뒤에 앨범 표지·실제 구김 질감 `public/paper-crumple.png`
  — ambientCG Paper003(CC0) 기울기 지도에 빛을 구움, `frontend/scripts/paper-bake.html`)
- 카드 인쇄 9.4 → 5.5초(넓은 흐림 그림자·바코드 div 64개가 범인), 서버 서랍은 `GET /api/share/:id` 로 같은 카드를 다시(캐시 — 두 번째부터 0.5초)
- **보관함 공유 버그**(카드 다 그린 뒤 공유 창 → 클릭 만료로 거부 → 아무 일 없음) 고침 — 결과 화면과 같은 카드 화면(CardReveal), 거부되면 내려받기
- 보관함: 서랍 = 플레이리스트 수(0개면 안내), 디스크 5장씩 두 줄, 조명 낮춤, **디스크를 누르면 곡 카드**(표지·곡 설명·미리듣기, `TrackSheet`)
- 결과: 마우스 휠로 디스크 넘기기, 서랍 이름표는 화면 가운데에 크게
- 자막 자글거림 가장자리만·불규칙·잘게, 녹음 없는 대사 자막만, 가짜 곡은 로컬 개발에서만(배포에선 한 번 더 부르고 "다시 찾기")
**테스터 피드백(10/2)** — 버그(보관함 공유)·휠·이름표·카드 다시 보기·디스크 곡 카드는 고침. "포기하고 싶을 때 → 이센스 비행 아쉬움" 은 기록이 쌓이면 판단

## 10/1 한 일 (전부 main·배포됨)
**추천**
- 가사 못 찾던 92곡 대부분이 노래 있는 곡 — LRCLIB 이 한국 곡을 영문 이름으로 가져서. 미국 스토어 표기로 다시 찾기·굽은 따옴표·망 실패는 다음 배치.
  `Track.instrumental`(연주곡/노래/못 찾음). 다시 설명 뒤 가사 찾은 곡 152 → 259곡
- 요청 풀어 쓰기를 요청 종류별로(소재·감정·지침·할 일), 가수·장르를 직접 말하면 그대로(`arrange()` — 서비스·평가가 같이 쓴다). Last.fm 영어 태그를 `SearchLog.tags` 에
- 한 번에 **10곡**, 던진 곡 기록(`ThrowLog`, 감점·곡 풀 씨앗에서 덜 센다), 한글 제목 우선(새 곡부터)
- **곡 설명·요청 풀어 쓰기 "[핵심어 3개]+묘사"**(Gemini 에게 물어 받은 안) + **재정렬 순서를 실제로 씀**(후보 20곡, 6초 넘으면 1단계 순서, 말한 가수 곡은 고정 — `finalOrder()`).
  신의 한마디도 같은 응답으로 와서 화면은 `/recommend/line` 을 안 부른다. 곡별 이유는 화면·프롬프트에서 뺐다(응답 5.3 → 4초)
- 평가: 기존 39개 + 소재·가수·장르 6개(Claude 초안, **사용자 확인 전**). 결과는 아래 "평가 기록"
**화면**
- 자막 노란색(채도 낮춘 `#e2cd5a`) + 검정 테두리 + 옛 필름처럼 살짝 자글자글, 화면 폭 따라 크기, 두 줄까지, 대사 끝 3초 뒤 사라짐. 영화 띠는 위아래 각 8% 까지
- 편지지 반응형(프레임 높이 기준)
- 결과 화면: 오른쪽 파란 곡 목록 + 재생(목록 아래, 선 하나 진행바, 이유 한 줄 없음), 디스크 밑 글 삭제, 라벨은 조명 안 받는 재질, 표지 미리 받기(400px),
  디스크가 드라이브 **앞면 입구로** 들어감(드라이브는 화면 아래 끝에 입구만), **로딩은 3D 방에서 서랍 뒤지기** → 정면 서랍에서 디스크가 솟아오름
- **공유**: 서랍에 넣으면 카드(1080×1920)가 인쇄돼 올라옴(길게 눌러 저장·스토리·링크 복사), 보관함 서랍에도 공유 버튼,
  **공개 서랍 링크 `/s/:id`**(카톡 미리보기 = 카드, 열면 곡·미리듣기·유튜브·"나도 편지 써 보기"), 카드 QR 은 공개 서랍으로. 요청문 공개(사용자 결정)
**계정·운영**
- **비밀번호 찾기**: Gmail 앱 비밀번호로 30분짜리 재설정 링크(`/auth/forgot`·`/auth/reset`, `/reset` 화면). 가입 여부는 안 흘린다
- trust proxy(배포에서 모든 IP 가 하나로 보이던 것), Gemini 예비 모델·404 다음으로, 스웨거 `[Gemini]` 표시, 곡 설명 배치 6초 → 3.1초
- 곡 풀 305곡(배고파·재즈 등 추가)

## 평가 기록 (기존 39개 요청, 상위 5곡 재현율)
| 곡 설명 | 순서 | 곡 풀 | 재현율 |
|---|---|---|---|
| 옛(가사 없는 곡 많음) | 1단계 | 243 | 42% |
| 구체 서사형(cd5f2da) | 1단계 | 243 / 304 | 28% / 23% |
| [핵심어]+묘사 | 1단계 | 243 / 304 | 30% / 27% |
| **[핵심어]+묘사 (지금)** | **재정렬** | 304 | **38%** (45개 전체 41%, 새 6개 58%) |
- 요청 프롬프트 새것·옛것은 재현율이 같다(42%) — 9/30 의 28/39 는 Lite 한도가 차서 예비 모델이 해석한 탓이었다
- 새 6개(배고파·오아시스·아이유·여름·재즈·피아노)는 서사형에서도 잘 맞았다(오아시스 3/3, 아이유 2/2, 배고파 → 기리보이 1위)

## 9/30 한 일
- **곡 풀 244곡** — 빈 커버·미리듣기 고침(collect 곡 사이 3초, 한국 스토어 미리듣기 없으면 미국), Stardust·반주 판 삭제,
  장르 채우기로 제이팝·재즈·샹송·힙합 40곡(YOASOBI·우타다·아즈나부르·피아프·사데·아웃캐스트…). 전부 소리 숫자, 설명 243곡(1곡 새벽 배치가 다시)
- **평가 세트 사용자 확정**(eval.json) — 204곡 기준 32/39·46%. 0점 요청 진단: ① 요청 풀어쓰기가 "위로(처방)"로 씀 → 공감형으로 바꿔 봤으나 28/39 로 나빠져 되돌림
  ② 가수당 1곡 규칙이 둘째 곡을 100등 밖으로 → 2곡까지(유지) ③ **가사 없는 곡 설명이 "가사 없는 연주곡"이라 거짓말** → 두루뭉술해 어디에나 끼어듦(미해결, 아래)
- **장르 다중 선택**(편지지 칩 11개, `g=` → 고른 장르 곡만, 6곡 미만이면 나머지로 채움). `POST /catalog/grow {tags}` 로 장르만 모으기
- **나레이션**: 신의 한마디 ~게나·~군 줄이고 너스레 유머, 결과 고정 대사(다 던짐·더 없음·서버 오류) 새로 씀 — 음성 녹음은 다시 해야 함
- **ElevenLabs 영어 음성**(`voice/voice.ts`, `GET /voice/:id`, `.voice-cache/`) — 켜고 끄기·모델 선택. **무료 등급은 API 로 라이브러리 목소리 불가(402)** → 유료·기본 목소리·끄기 중 사용자 결정 대기.
  비교 스크립트는 두 모델 × 대사 3개
- **속도 8.5~13.5초 → 2.2~2.8초**: 곡 목록 메모리(1분마다 가볍게 변경 확인), 풀어쓰기와 동시에, 화면 순서는 1단계 그대로,
  신의 한마디·이유는 `GET /recommend/line` 으로 디스크 뒤에(1.7~2초). Gemini 재정렬 순서는 안 씀
- **서버 오류를 가짜 곡으로 덮던 것** 고침 — 가짜 곡은 서버에 못 닿을 때만, 오류면 "서랍이 뻑뻑하네" + 다시 뒤지기


## 남은 일 → [docs/next.md](docs/next.md)

## 목표
docs/ui-ux-spec.md 의 5개 페이지를 순서대로 구현. 프론트는 백엔드(인증·추천·서랍)에 붙었고, 서버가 없으면 가짜 데이터로 돈다.

## 구조
`app/` 은 라우트 + 페이지 상태 흐름만. UI 조각은 `components/<페이지>/`, 공용 유틸은 `lib/`.

## 완료
- 1·2번 랜딩/인증 + 로딩: `app/page.tsx`(로그인), `app/signup/page.tsx`(회원가입) → `components/landing/AuthFlow.tsx` 공용. 고정 카메라로 멀리 선 3D 서류함(RoundedBox + 절차적 텍스처 `materials.ts`; 끊김 때문에 N8AO 후처리 제거), 고정 키 라이트(커서 광원은 어색해서 제거), 열기 전 맨 위 서랍이 3초마다 톡톡 들썩여 호버 유도. 호버 시 맨 위 서랍이 브루스 올마이티처럼 7.2유닛(`FULL_OPEN`) 길게 쫙 빠짐(몸통·인스턴스 폴더가 길이 따라 늘어남) → `FileCard` 가 한 장씩 카메라 앞으로 날아오고 입력칸은 DOM 오버레이(PRESENT_TOP 위치, 3D Html 은 느려서 버림)(fields 순서), 끝나면 서랍 열린 채 로딩: 서랍 쾅 닫힘(CLOSE_MS 0.7초) → 서류함 뒤 후광(`LoadingOverlay.tsx` 의 `Halo` — 투명 캔버스 뒤엔 흰 빛살(conic 두 겹 + 마스크, 천천히 회전) + 어두운 바탕(#0b0d12, 3D 조명·안개도 함께 어두워짐 — `Lights` dim), 앞엔 흰 radial, 진행률 따라 커지다 화면 전체를 하얗게 덮음) + 성가 BGM(`lib/choir.ts`, Web Audio 합성) → 하얀 채로 /search. 다이브(가운데 서랍·암전 터널) 없앰. 카메라는 서랍 정면 고정
- 음성은 영어(ElevenLabs, `docs/voice-script.csv`), 자막은 한국어. 음성 파일(29개, `public/voice/`)에서 말소리 사이 가장 긴 쉼 N−1개(N=자막 줄 수, 잔향 때문에 최고 음량 15% 미만을 쉼으로 봄)를 찾아(`lib/cues.ts`) 자막 줄을 음성 문장에 맞춰 띄움. 대사는 끊지 않고 대기열로 이어 재생(엔터만 예외 — `cut()` 으로 즉시 끊고 자막도 지움. 말 끝 = 분석한 마지막 말소리, 파일 끝 공백은 안 기다림, 기다리는 중엔 최신 1개만), 자막은 그 대사 소리가 시작될 때 바뀜. 페이지 떠나도 끝까지 나옴, `/search` 이동은 `whenQuiet()` 뒤. 첫 대사는 페이지별(`LINES.intro` — INTRO / INTRO_SIGNUP / INTRO_FORGOT)
- 자막 표시(`components/landing/Subtitle.tsx`): 위쪽 고정(top 74%), 새 줄이 위에 펼쳐지며 먼저 나온 줄을 아래로 밀어냄. 로딩(후광) 중엔 서랍 호버·키보드 열기 잠금
- 자막: 바탕 박스 없이(9/30 뺌) 흰 조선굴림체 + 얇은 검정 테두리(`app/fonts/ChosunGu.woff`, `font-subtitle`), 긴 문장은 문장별로 줄 나눠 "- " 시작(`subtitleLines`). 음성 파일 `public/voice/{키}.mp3`(없으면 자막만, 10/2), 키 목록은 docs/voice-persona.md 4번
- 안내는 영화 자막 + 목소리(`lib/voice.ts`, Web Speech API — 첫 사용자 입력 전엔 무음). 문구는 전부 `components/landing/lines.ts`(말투 = `docs/voice-persona.md`, 브루스 올마이티의 신 "자네"): 필드별(prompt/missing/invalid/tooShort/mismatch) + 흐름(idle·30초 재촉·CapsLock·대조 중·틀림·계정 없음·이미 가입·서버 오류·환영/재방문·로딩·열쇠 찾기). ESC 로 앞 서류. 회원가입 = 이메일→닉네임(2~12, 한/영/숫자/_)→비밀번호(8자+)→확인. `/forgot` 열쇠 찾기(가입 여부 안 흘림). 인증은 백엔드 /auth (`lib/auth.ts` → `lib/api.ts`, JWT 는 localStorage `cabinet.token`). 로그인 실패는 계정 유무 구분 없이 "비밀이 틀렸네".
  회원가입 이메일은 첫 칸 Enter 때 형식(끝말 .com 까지)·가입 여부를 바로 검사(`/auth/check-email`). 첫 화면에서 토큰을 `/auth/me` 로 확인해
  무효(401)면 흔적을 지우고 평소 로그인으로(예전엔 토큰이 있기만 하면 "또 왔군" 하고 들어갔다)
- 3번 키워드 입력: `frontend/app/search/page.tsx` + `components/search/` — 흰 테마 편지지(순백 + 그림자색만, "신" 단어 금지, 명조체 `font-letter` = Nanum Myeongjo. 메일 작성창 버전은 해봤다가 롤백), 그림자색 타이핑 입자, Enter 제출 → `/results?q=` (4번은 아직 다크)
- 5번 아카이빙 메인 룸: `frontend/app/archive/page.tsx` + `components/archive/` — 감정 테마 태그가 네임택으로 붙은 3단 개인 서류함(4번과 같은 방). 서랍을 누르면 앞으로 열리며 카메라가 위로 올라가 내려다보고, 서랍 3개씩 넘겨 봄. 보관 기록은 `components/archive/shelf.ts` — 로그인했으면 백엔드 /shelves 가 원본(보관함 들어올 때 동기화), localStorage 는 사본
- 5.1 문서 보고서 (**꺼 둠, 2026-09-28** — 라우트는 notFound, 링크 주석 처리. `grep "보고서 꺼 둠"` 으로 되살림): `frontend/app/report/[id]/page.tsx` + `components/report/Report.tsx` — 빛바랜 종이, 대외비 도장, 요청문 인용, 대조 결과 막대
- 4번 결과: `frontend/app/results/page.tsx` + `components/results/` — 전부 R3F. 검은 공간에 흰 서류함이 빙 둘러선 방(`CabinetWall`, 보관함과 공유하는 `Wall`) 안에
  3D 플로피가 줄지어 섬(`Deck`·`floppy.tsx`). 곡은 백엔드 /recommend(없으면 `tracks.ts` 가짜 12곡), 라벨·재생바에 iTunes 커버.
  호버 타자기 점수(라벨 텍스처), 드래그 360° 회전, **짧게 클릭 → 아래 드라이브 슬롯에 꽂혀 재생**(꽂힌 디스크 클릭·↑ 키 = 빼기, ↓ 키 = 꽂기),
  하단 재생바(`PlayerBar` — 커버·재생/멈춤·진행 막대·꺼내기, iTunes 30초 미리듣기). 헤더에 "요청 해석" 태그.
  위로 뿌리거나 가만히 꾹 누르면(0.9초, 움직이면 취소) 던져져 벽에 부딪히고 바닥에 멎은 뒤 목록에서 빠짐(`Flights` 물리).
  **다 던지면**: 신의 대사(RESULT_EMPTY) + "던진 곡은 빼고 다시 찾기"(thrown) / "같은 편지로 몇 곡 더"(seen), 더 없으면 RESULT_DRY → 새 편지.
  두 대사 음성은 녹음 전(기계 음성), voice-script.csv 에 추가해 둠.
  "서랍에 넣기" → 디스크가 아래 서랍으로 빨려 들고 네임택에 이름을 찍은 뒤 저장해 보관함으로(`SaveDrawer`)
- 성능: 둘러선 벽을 InstancedMesh 로(메시 1,100여 개 → 5개) — 결과·보관함 첫 화면이 늦던 원인
- 공용: `frontend/lib/thud.ts` (Web Audio "탁"), `globals.css` 에 토큰/서랍/키프레임
- 루트 `npm run dev` (`dev.mjs`) 로 프론트+백엔드 동시 실행, 백엔드 기본 포트 4000
- **영화 비율 프레임(9/28)**: 모든 화면이 2.39:1 `.cinema` 프레임 안(layout.tsx·globals.css, 비율은 `--cinema`). 프레임 안에선 vh 대신 cqh·cqmax,
  안쪽 fixed 는 프레임 기준. 랜딩 자막은 portal 로 프레임 아래 검은 띠 `#cinema-sub`. 세로 화면은 전체 화면(모바일 때 다시)
- **Claude Code 설정(9/28)**: `.claude/rules`(주제별·paths), `skills`(visual-check·backend-smoke), `hooks`(.env·db 수정, 강제 푸시·클로드 서명·
  로컬 작성자 없음·.env/db·puppeteer 커밋 차단), `agents/test-runner`. 말투도 CLAUDE.md(모든 PC 공통)
- **9/28 리뷰 수정**: JWT 키 필수, 곡 수집 관리자 전용(`ADMIN_EMAILS`)·20곡 제한, 로그인 튕김, 돌리다 던져짐, 보관함 3개씩 넘겨 보기,
  비밀번호 72바이트, 로그인 5회 실패 15분 잠금, 유튜브 사용량 파일(`.yt-budget.json`), iTunes 가수 번호 매칭(6/6), `.env` 있을 때만 읽기,
  서랍 저장 타이머 정리, 네임택 텍스처, 서랍 이름 제안 오탐, 5.1 보고서 꺼 둠

## 백엔드 (NestJS, :4000)
- **인증**: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`, `POST /auth/check-email`(가입 여부, IP 당 10분 30번) — bcrypt 해시, JWT 7일.
  이메일은 검증 전에 공백·대문자를 다듬고, 로그인 실패는 계정 없음/비밀번호 틀림을 구분해 알리지 않는다.
  JWT 서명 키는 `JwtModule.registerAsync` 로 .env 에서 읽어야 한다 (`register()` 면 모듈이 .env 보다 먼저 평가돼
  서명 키와 검증 키가 어긋나 /auth/me 가 401)
- **추천**: `GET /recommend?q=&seen=&thrown=` → 요청 해석 태그 + 곡별 의미·분위기 점수 + 겹친 태그, `GET /recommend/:id?q=`.
  해석 = `recommend/interpret.ts` 한국어 낱말 사전(**GPT 자리 임시** — 개편안은 docs/recommend-plan.md), 점수 = 태그 가중치 코사인(DRIFT 에서 옮김).
  thrown 은 빼면서 그 곡들 태그 쪽에서 멀어지고, seen 은 빼기만. 한국 곡은 Last.fm 에 분위기 태그가 거의 없어 분위기 일치도는 뺐다(9/28, 점수는 일치도 하나),
  의미 점수도 20~35% — 사전 태그가 DB 에 없는 태그를 많이 내서. LLM + DB 태그 목록 제약으로 풀 예정
- **서랍**: `GET/POST/DELETE /shelves` (JWT). 곡은 제목·가수로 하나만 둔다
- **곡 태그**: Last.fm `track.getTopTags`(3개 미만이면 `artist.getTopTags` 로 보충) → `Track.tags` JSON. 수집(`/catalog/collect`) 때 같이.
  **둘 다 없으면 iTunes 장르**(`catalog/genres.ts`, DRIFT 에서 옮김, 9/28) — 태그가 없으면 추천에서 빠져서. **한계(나중에 문제되면 교체)**:
  미국 스토어는 한국 곡을 거의 다 "K-Pop" 하나로 묶어(발라드·인디 구분 없음) 이 곡들끼리 점수가 같다. 한국 스토어가 0건인 날(간헐 장애)엔
  가수 이름이 영문으로 달라 iTunes 에서도 못 찾아 빈 채로 남는다(예: 너드커넥션). 교체안 = LLM 태깅(가사 LRCLIB 참고, DB 태그 목록 안에서)
- **곡 풀**: 88곡(9/28 배치 후). 태그 0개인 곡은 추천에서 빠진다. 9/28 유저·서랍 전부 비움(Track 은 남김), 로컬 JWT_SECRET 새로 만듦
- **곡 풀 넓히기 — 관리자 배치(9/28 구현)**: `POST /catalog/grow {target}`(관리자, 뒤에서 돎) · `GET /catalog/grow`(진행 상황) · 매일 새벽 4시(서버 시간) 자동.
  검색은 해석 태그·결과 상위 가수만 `SearchLog` 에 남기고 외부 호출 없음. 배치 씨앗 = 최근 7일 검색 태그·가수 + 한국 태그(k-indie 등) + 애플 뮤직 한국 차트.
  후보 = Last.fm 태그 인기곡·비슷한 가수 인기곡·차트를 출처별로 번갈아. 한국 곡만(한글 이름 또는 korean·k-* 태그), 반주(inst·MR·karaoke)는 거르고
  리믹스·라이브는 살림, 같은 곡 다른 표기는 미리듣기 URL 로 거름, 태그 없으면 iTunes 장르. iTunes 분당 20회라 곡당 3초 — 30곡에 2~3분.
  확인: 28곡 보고 8곡 담음(한국 스토어가 0건인 날이라 이름이 영문으로 들어옴 — Kim Dong Ryul 등). 추천은 가수당 1곡 먼저
- **영상 ID — 9/28 확정·구현**: 필요할 때 + 밤 배치 ([docs/youtube-playlist-plan.md](docs/youtube-playlist-plan.md) 3장).
  `POST /shelves/:id/playlist` → 모르는 곡만 유튜브 검색 → watch_videos 링크 + 못 찾은 곡 검색 링크. 밤 배치 = 태평양 23:30 남은 몫으로
  서랍에 많이 담긴 곡부터(`catalog/videos.ts`). 수집은 유튜브를 안 부른다. 못 찾은 곡은 30일 재질문 안 함. 보관함에서 서랍 열면
  "유튜브에서 이어 듣기"(`ListenPanel`). 키 발급·확인 완료(검정치마·새소년 MV 정확히 찾음).
  영상 고르기 = `pickVideo`(Topic > 가수 채널 > 첫 결과, 라이브·스케치북·커버 제목은 뺌 — 9/28 10CM 그라데이션에 KBS 라이브가 걸려서).
  그라데이션의 잘못 저장된 videoId 는 9/30 비움 — 다음 재생목록 요청·밤 배치 때 pickVideo 로 다시 찾음
- **가수 이름 통일(9/28)**: iTunes 가 한국 스토어도 영문명을 줘서(아이유 → "I.U.") 섞이던 것 — `catalog/musicbrainz.ts` 로
  한국 가수면 한글 이름(없으면 한국어 대표 별칭·하나뿐인 예명, 본명 안 씀). 기존 38곡도 바꿈. 곡 제목 번역(잔나비 "A Thought on an Autumn Night")은 아직.
  테스트 곡(zzqx)은 9/30 지움
- **DB 보기**: 루트 `npm run dev` 가 Prisma Studio 도 같이 띄움(http://localhost:5555, 원격 Neon) 또는 Neon 콘솔(console.neon.tech, 프로젝트 cabinet)의 Tables.
  이 PC(9/30) `backend/.env` 의 `DATABASE_URL` 이 아직 `file:./dev.db` — Neon direct 주소로 바꿔야 백엔드·Studio 가 켜짐
- **Swagger**: http://localhost:4000/docs (Authorize 에 토큰)
- **DB — 9/28 Neon(원격 Postgres, 싱가포르)으로 옮김**: 여러 PC 가 같은 곡·서랍을 본다. 다른 PC 도 `backend/.env` 의 `DATABASE_URL` 을 같은 direct 주소로
  (Neon 콘솔 Connect → Connection pooling 끄고 복사). 어댑터 `@prisma/adapter-pg`, 마이그레이션은 Postgres 용 init 하나로 새로 시작(SQLite 것은 삭제).
  dev.db 의 전 테이블을 그대로 복사함(곡 89·유저 1·서랍 1). `backend/dev.db` 는 옛 사본 — 더 안 씀. 테스트 계정도 모든 PC 에 보이니 쓰고 지운다.
  pg 가 `sslmode=require` 에 보안 경고를 띄움 — .env 주소를 `sslmode=verify-full` 로 바꾸면 사라짐(동작은 같음).
  모델 `User` / `Shelf`(서랍=저장한 목록, 네임택·요청문) /
  `Track`(커버·미리듣기·videoId) / `ShelfTrack`(순서).
  Prisma 7 부터 스키마에 `url` 을 못 쓴다 — `prisma.config.ts` + 드라이버 어댑터(`@prisma/adapter-better-sqlite3`),
  `.env` 도 자동으로 안 읽어서 config 에서 `process.loadEnvFile()` 한다
- **곡 수집**: `GET /catalog/tracks`, `POST /catalog/collect`, `GET /catalog/budget`
  - iTunes(키 없음): 커버 600x600 + 30초 미리듣기. kr 0건이면 us 폴백. **간헐적으로 0건을 준다**(재시도·다른 소스 필요)
  - 영상 ID: 유튜브 검색만(100단위, 하루 상한 `YT_SEARCH_DAILY_LIMIT`). 찾으면 DB 에 영구 보관
  - 확인: 가짜 곡 6곡 커버·미리듣기 6/6 성공(URL 200), **영상 ID 0/6**
- **.env** (git 무시, 예시는 `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `PORT`,
  `ADMIN_EMAILS`, `LASTFM_API_KEY`(발급 완료), `YOUTUBE_API_KEY`(9/28 발급·적용), `YT_SEARCH_DAILY_LIMIT`

## 가짜로 둔 것 (`ponytail:` 주석)
- 열쇠 찾기: 메일 발송 없음
- 로딩 진행률: 타이머
- 서버가 없을 때 결과 곡: `tracks.ts` 가짜 12곡

## 다음
- **비공개 베타 배포(9/30 결정)** — 절차 [docs/deploy.md](docs/deploy.md). 프론트 Vercel · 백엔드 Railway(항상 켜짐) · DB Neon. 모바일은 안 함, Gemini 는 무료 한도(테스터에게 데이터 안내).
  1일차: feat/recommend → main 합침(9/30 로컬, 푸시 전), 곡 풀 88곡 → 늘리는 중. 2일차 배포, 3일차 테스터
- **바로 다음 — 추천 개편, [docs/recommend-plan.md](docs/recommend-plan.md)(9/30 개정, 브랜치 `feat/recommend`)**: 태그 안을 버리고 두 단계.
  1단계 거르기 = 뜻(GPT 곡 설명 → 임베딩 코사인) + 소리(에너지·밝기 거리) → 20~30곡, 2단계 = GPT 가 곡 설명을 읽고 재정렬 + 한 줄 이유.
  장르·Last.fm 태그는 점수에서 뺌(사용자: 장르가 같아도 느낌이 달라 교집합이 없다). acousticness·danceability 는 energy·valence 와 겹쳐 뺌(상관 −0.86·0.77).
  ① ReccoBeats 소리 숫자 **9/30 완료**(`catalog/sound.ts`, 86곡). 회사망은 IPv6 가 막혀 `main.ts` 에 ipv4first
  ② 곡 설명 + 임베딩 배치 **9/30 완료**(`catalog/describe.ts`, 88곡, 가사 59곡) ③ 요청 풀어 쓰기 + 1단계 점수 **9/30 완료**(`recommend/interpret.ts`·`score.ts`)
  ④ 평가 세트 30개 ⑤ Gemini 재정렬. LLM 은 **Gemini 무료 한도**(학생 — GPT 대신). 모델마다 하루 20번이라 요청은 하루 수십 번이 한계, 공개 전 유료로.
  ④ 평가 세트 초안 39개(`backend/src/recommend/eval.json`, 88곡 전부 씀) + `npm run eval` — **9/30 38/39·재현율 65%**(평균 빼기 + A 0.5, 처음 30개로 24/30·43%).
  ⑤ 재정렬 + 신의 한마디 **9/30 구현**(`recommend/rerank.ts`, 결과 화면 자막 띠·디스크 이름표 밑 이유). 재정렬 모델은 Lite(하루 500번, 3.8-flash 는 20번) — 평가 36/39·56%(1단계만 65%) — 정답지 편향일 수 있어 보류.
  음성은 기계 음성 임시, ElevenLabs 는 나중(`line.en`). **사용자 확인 대기: eval.json 의 요청·기대 곡** → 재정렬 순서를 쓸지 결정. 일치도는 요청마다 60~99% 로 늘려 보임(순위 그대로)
  그다음 인스타 스토리 재생목록 카드(아래 "바이럴 인증물"). 푸시는 9/28 완료
- DRIFT 곡 가져오기: 이 PC 의 DRIFT DB(prisma dev Postgres)는 곡 4개·한국 곡 0 — 장르별로 모은 건 다른 PC(HKCMC) DB 일 것. 거기서 songs CSV 로 뽑아 와야 함
- **곡 특징 보강 후보**: 가사 = LRCLIB(무료·키 없음, 한국 곡 있음 — 분석에만, 화면 표시 금지), BPM = Deezer track.bpm(무료),
  키·장조 = iTunes 미리듣기를 직접 분석(librosa/essentia, ai-report-plan 2단계)
- (9/30 처리) 자막 박스 뺌, 랜딩 카메라 20% 당김(`CAMERA` 0,1.96,11.6) + 서랍 빠지는 길이 9 → 7.2(앞면이 화면 안에 남게)
- **파이프라인 확정(2026-09-28)** — 스포티파이는 전부 뺀다(개발 모드 5명 제한 + 정책상 다른 서비스로 넘기기·AI 입력 금지):
  1. LLM = 의도 파서만. 요청문 → 태그 JSON. **DB 에 실제 있는 태그 목록 안에서만** 고르게 출력 형식을 묶는다
     (자유 키워드 "비오는날" 은 곡의 Last.fm 태그 "rainy" 와 글자가 달라 점수가 0 이 된다). 곡은 지어내지 않는다
  2. 곡 고르기 = 코드. 미리 모아 둔 DB 곡 목록에서 태그 점수 상위
  3. DB 는 관리자 배치로 채운다: 곡 정보·표지·30초 미리듣기 = iTunes(가수 번호로 매칭), 태그 = Last.fm(없으면 iTunes 장르).
     영상 ID 는 재생목록 요청 때 + 밤 배치(위 "영상 ID"), 곡당 1회 → 영구 저장. 검색 요청 중엔 외부 호출 0
  4. 출구 = watch_videos?video_ids=… 익명 링크(로그인·할당량 0, 공식 문서엔 없는 주소라 깨질 수 있음) + 인스타 카드
  - 할 일: 애플 표지·미리듣기 출처 표시 조건 원문 확인
- **순서 합의: 화면 목업 완성 → 백엔드·상세 기능** (모바일은 그 뒤)
- **바이럴 인증물 — 방향 확정(2026-09-28), 다음 작업**: 인스타그램 스토리 공유용 **재생목록 카드 한 장**.
  최대한 심플하고 귀엽지만 cabinet 다운 특색(서랍·네임택·플로피). 카드에 만든 재생목록을 쉽게 공유할 수단을 담는다 —
  읽기 전용 공개 페이지 링크(`/shelf/{id}` 류)를 띄우고, 그 페이지에서 바로 유튜브 재생목록으로 만들 수 있게
  (`docs/youtube-playlist-plan.md` 의 watch_videos 링크 = 로그인·할당량 없이). 보관증 클립(MediaRecorder)은 보류
- **유튜브 영상 ID 를 어떻게 채울지 — 막힌 지점.** 키 없이 되는 길은 사실상 없다(직접 확인):
  Odesli(song.link) 공개 API 폐지(401 PUBLIC_API_ACCESS_DEPRECATED), Piped 공개 인스턴스는 HTML 만,
  Invidious 는 접속 실패/403, Deezer 는 되지만 유튜브 링크가 없다.
  MusicBrainz 는 한국 인디 곡 자료가 얕다(검정치마 Everything 은 url 관계 없음, 새소년 난춘은 등록 자체가 없음).
  → 선택지: (1) 유튜브 API 키 발급(재생목록 OAuth 와 같은 Google Cloud 프로젝트라 어차피 필요) (2) yt-dlp 류(약관 위반·취약)
  (3) 영상 ID 는 재생목록 붙일 때로 미루기. → **9/28 확정: (1) 유튜브 API 키, 관리자 배치로 미리 채움** (위 "파이프라인 확정")
- **Deezer 폴백 제안(미적용)**: iTunes 가 간헐적으로 0건을 주므로, 키 없이 되는 Deezer 로 커버·미리듣기 성공률을 올릴 수 있다
- 아키비스트 AI 보고서(XAI): 계획은 [docs/ai-report-plan.md](docs/ai-report-plan.md) — 아래 결정으로 문서 갱신 필요
  - 원칙: 숫자는 코드가 계산, LLM은 문장만
  - 1차 특징 = Last.fm 태그 (`track.getTopTags`, 태그별 가중치 0~100. 태그 적으면 `artist.getTopTags` 로 보충). BPM 등 부족한 특징은 2차에 수집
  - 축(기준 단어 임베딩) 방식은 뺌 — 태그가 이미 이름 붙은 기준이라 필요 없음. e5 임베딩도 1차엔 불필요
  - 흐름: LLM이 요청 문장을 태그 몇 개로 해석("요청 해석"으로 표시) → 코드가 곡 태그 가중치와 겹침으로 일치 점수 계산 → LLM이 겹친 태그·점수만 받아 보고서 문장
  - Last.fm: 무료 API 키, 비상업·출처 표기 조건
  - **미정 — 프론트 배치 (사용자 고민 중).** 보고서가 결과보다 먼저 또는 동시에 나와야 설득력 있음(결과 먼저면 끼워 맞춘 핑계처럼 보임). 후보:
    1. 보고서가 디스크 꺼냄: 보고서가 한 줄씩 인쇄되고, 곡 문단이 끝나는 순간 그 디스크가 튀어나옴. Riffle 대신. (제안안)
    2. 요청 해석 먼저, 곡 이유는 라벨지: Riffle 동안 "요청 해석"만 인쇄, 디스크 나온 뒤 라벨지에 이유 한 줄씩
    3. 좌우 분할 동시: 왼쪽 보고서, 오른쪽 캐러셀, 가운데 디스크 문단 강조
- 유튜브 재생목록 만들기(미리듣기는 iTunes): [docs/youtube-playlist-plan.md](docs/youtube-playlist-plan.md). 요약 — 검색(100단위)을 피하려 곡↔영상 짝을 관리자 배치(유튜브 검색 곡당 1회)로 미리 DB 에 적재, 재생목록은 로그인 없는 watch_videos 링크(할당량 0)와 OAuth 생성 두 갈래. 스포티파이는 데모 저장까지 전부 뺌(9/28)
- 모바일 대응: [docs/mobile-plan.md](docs/mobile-plan.md) — 보류. 목업 완성 후 1단계(뷰포트·dvh·터치 제스처·카메라 화각·성능 단계)부터
- 3D 모델: Sketchfab GLB 받으면 `frontend/public/models/` 에. 서랍장 외형만 교체하고 긴 서랍/파일 연출은 유지 (라이선스·출처 표기 확인)
- 추천 품질: 곡 풀 늘리기, LLM 요청 해석, 분위기 특징 보강
- 자연어 처리 안정성: LLM 은 요청문 → 태그 가중치만, 곡 선택은 코드. 온도 0·모델 고정·요청문 정규화 후 해시 캐시로
  같은 문장이면 같은 결과. 화면에 "요청 해석" 태그를 보여 준다
