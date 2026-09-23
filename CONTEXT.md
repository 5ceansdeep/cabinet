# cabinet 작업 컨텍스트 (2026-09-21)

## 목표
docs/ui-ux-spec.md 의 5개 페이지를 순서대로 구현. 백엔드 API 전이라 프론트는 가짜 데이터로 띄운다.

## 구조
`app/` 은 라우트 + 페이지 상태 흐름만. UI 조각은 `components/<페이지>/`, 공용 유틸은 `lib/`.

## 완료
- 1·2번 랜딩/인증 + 로딩: `app/page.tsx`(로그인), `app/signup/page.tsx`(회원가입) → `components/landing/AuthFlow.tsx` 공용. 고정 카메라로 멀리 선 3D 서류함(RoundedBox + 절차적 텍스처 `materials.ts`; 끊김 때문에 N8AO 후처리 제거), 고정 키 라이트(커서 광원은 어색해서 제거), 열기 전 맨 위 서랍이 3초마다 톡톡 들썩여 호버 유도. 호버 시 맨 위 서랍이 브루스 올마이티처럼 8유닛 길게 쫙 빠짐(몸통·인스턴스 폴더가 길이 따라 늘어남) → `FileCard` 가 한 장씩 카메라 앞으로 날아오고 입력칸은 DOM 오버레이(PRESENT_TOP 위치, 3D Html 은 느려서 버림)(fields 순서), 끝나면 서랍 열린 채 로딩: 서랍 쾅 닫힘(CLOSE_MS 0.7초) → 서류함 뒤 후광(`LoadingOverlay.tsx` 의 `Halo` — 투명 캔버스 뒤엔 흰 빛살(conic 두 겹 + 마스크, 천천히 회전) + 어두운 바탕(#0b0d12, 3D 조명·안개도 함께 어두워짐 — `Lights` dim), 앞엔 흰 radial, 진행률 따라 커지다 화면 전체를 하얗게 덮음) + 성가 BGM(`lib/choir.ts`, Web Audio 합성) → 하얀 채로 /search. 다이브(가운데 서랍·암전 터널) 없앰. 카메라는 서랍 정면 고정
- 음성은 영어(ElevenLabs, `docs/voice-script.csv`), 자막은 한국어. 음성 파일(29개, `public/voice/`)에서 말소리 사이 가장 긴 쉼 N−1개(N=자막 줄 수, 잔향 때문에 최고 음량 15% 미만을 쉼으로 봄)를 찾아(`lib/cues.ts`) 자막 줄을 음성 문장에 맞춰 띄움. 대사는 끊지 않고 대기열로 이어 재생(엔터만 예외 — `cut()` 으로 즉시 끊고 자막도 지움. 말 끝 = 분석한 마지막 말소리, 파일 끝 공백은 안 기다림, 기다리는 중엔 최신 1개만), 자막은 그 대사 소리가 시작될 때 바뀜. 페이지 떠나도 끝까지 나옴, `/search` 이동은 `whenQuiet()` 뒤. 첫 대사는 페이지별(`LINES.intro` — INTRO / INTRO_SIGNUP / INTRO_FORGOT)
- 자막 표시(`components/landing/Subtitle.tsx`): 위쪽 고정(top 74%), 새 줄이 위에 펼쳐지며 먼저 나온 줄을 아래로 밀어냄. 로딩(후광) 중엔 서랍 호버·키보드 열기 잠금
- 자막: 줄마다 반투명 회색 박스 + 흰 조선굴림체(`app/fonts/ChosunGu.woff`, `font-subtitle`), 긴 문장은 문장별로 줄 나눠 "- " 시작(`subtitleLines`). 음성 파일 `public/voice/{키}.mp3`(없으면 기계 음성), 키 목록은 docs/voice-persona.md 4번
- 안내는 영화 자막 + 목소리(`lib/voice.ts`, Web Speech API — 첫 사용자 입력 전엔 무음). 문구는 전부 `components/landing/lines.ts`(말투 = `docs/voice-persona.md`, 브루스 올마이티의 신 "자네"): 필드별(prompt/missing/invalid/tooShort/mismatch) + 흐름(idle·30초 재촉·CapsLock·대조 중·틀림·계정 없음·이미 가입·서버 오류·환영/재방문·로딩·열쇠 찾기). ESC 로 앞 서류. 회원가입 = 이메일→닉네임(2~12, 한/영/숫자/_)→비밀번호(8자+)→확인. `/forgot` 열쇠 찾기(가입 여부 안 흘림). 가짜 인증 `lib/auth.ts`(localStorage, SHA-256) — 백엔드 생기면 함수 몸통만 fetch 로
- 3번 키워드 입력: `frontend/app/search/page.tsx` + `components/search/` — 흰 테마 편지지(순백 + 그림자색만, "신" 단어 금지, 명조체 `font-letter` = Nanum Myeongjo. 메일 작성창 버전은 해봤다가 롤백), 그림자색 타이핑 입자, Enter 제출 → `/results?q=` (4번은 아직 다크)
- 5번 아카이빙 메인 룸: `frontend/app/archive/page.tsx` + `components/archive/` — 감정 테마 태그가 네임택으로 붙은 3단 개인 서류함(4번과 같은 방). 서랍을 누르면 앞으로 열리며 카메라가 위로 올라가 내려다보고, 종이 파일 사이에 꽂힌 플로피를 누르면 5.1 보고서로. 보관 기록은 `components/archive/shelf.ts` 가짜 데이터
- 5.1 문서 보고서: `frontend/app/report/[id]/page.tsx` + `components/report/Report.tsx` — 빛바랜 종이, 대외비 도장, 요청문 인용, 대조 결과 막대
- 4번 결과: `frontend/app/results/page.tsx` + `components/results/` — 카드 촤르륵 연출, 플로피 디스크 캐러셀(스냅 스크롤), 호버 타자기 점수, 드래그 360° 회전 + 관성 복귀, 더블클릭 재생(효과음만)
- 공용: `frontend/lib/thud.ts` (Web Audio "탁"), `globals.css` 에 토큰/서랍/키프레임
- 루트 `npm run dev` (`dev.mjs`) 로 프론트+백엔드 동시 실행, 백엔드 기본 포트 4000

## 가짜로 둔 것 (`ponytail:` 주석)
- 로그인: 백엔드 인증 API 없음, 아무 값이나 통과
- 로딩 진행률: 타이머
- 결과 트랙: `components/results/tracks.ts` 하드코딩, 앨범 이미지는 그라디언트
- 미리듣기: 효과음 + NOW PLAYING 표시만, 실제 음원 없음

## 다음
- 5번 아카이빙 메인 룸, 5.1 문서 보고서
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
- 스포티파이 연동(믹스 편성 → 플레이리스트 생성, 위로 슬라이드로 곡 빼기): [docs/spotify-playlist-plan.md](docs/spotify-playlist-plan.md). 요약 — 플레이리스트 생성 O, 진짜 크로스페이드 믹싱 X(DRM), 믹싱은 iTunes 30초 미리듣기로. 스포티파이 로그인 강제 안 함(결과 화면에서 "연결"). 개발 모드는 사용자 5명 한도 + 앱 주인 프리미엄 필요
- 재생 슬롯에 밀어 넣기 인터랙션(4번) 미구현
- 3D 모델: Sketchfab GLB 받으면 `frontend/public/models/` 에. 서랍장 외형만 교체하고 긴 서랍/파일 연출은 유지 (라이선스·출처 표기 확인)
- 백엔드: 인증(JWT), 벡터 검색, Prisma 스키마 — 아직 없음
