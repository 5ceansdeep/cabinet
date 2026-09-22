# cabinet 작업 컨텍스트 (2026-09-21)

## 목표
docs/ui-ux-spec.md 의 5개 페이지를 순서대로 구현. 백엔드 API 전이라 프론트는 가짜 데이터로 띄운다.

## 구조
`app/` 은 라우트 + 페이지 상태 흐름만. UI 조각은 `components/<페이지>/`, 공용 유틸은 `lib/`.

## 완료
- 1·2번 랜딩/인증 + 로딩: `app/page.tsx`(로그인), `app/signup/page.tsx`(회원가입) → `components/landing/AuthFlow.tsx` 공용. 고정 카메라로 멀리 선 3D 서류함(RoundedBox + 절차적 텍스처 `materials.ts`; 끊김 때문에 N8AO 후처리 제거), 고정 키 라이트(커서 광원은 어색해서 제거), 열기 전 맨 위 서랍이 3초마다 톡톡 들썩여 호버 유도. 호버 시 맨 위 서랍이 브루스 올마이티처럼 8유닛 길게 쫙 빠짐(몸통·인스턴스 폴더가 길이 따라 늘어남) → `FileCard` 가 한 장씩 카메라 앞으로 날아오고 입력칸은 DOM 오버레이(PRESENT_TOP 위치, 3D Html 은 느려서 버림)(fields 순서), 끝나면 서랍 열린 채 로딩: 서랍 쾅 닫힘(CLOSE_MS 0.7초) → 서류함 뒤 후광(`LoadingOverlay.tsx` 의 `Halo` — 투명 캔버스 뒤엔 흰 빛살(conic 두 겹 + 마스크, 천천히 회전) + 옅은 그림자색 바탕, 앞엔 흰 radial, 진행률 따라 커지다 화면 전체를 하얗게 덮음) + 가운데 헤드폰 안내 한 번 페이드 인/아웃 + 성가 BGM(`lib/choir.ts`, Web Audio 합성) → 하얀 채로 /search. 다이브(가운데 서랍·암전 터널) 없앰. 카메라는 서랍 정면 고정
- 3번 키워드 입력: `frontend/app/search/page.tsx` + `components/search/` — 흰 테마 편지지(순백 + 그림자색만, "신" 단어 금지, 명조체 `font-letter` = Nanum Myeongjo. 메일 작성창 버전은 해봤다가 롤백), 그림자색 타이핑 입자, Enter 제출 → `/results?q=` (4번은 아직 다크)
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
- 재생 슬롯에 밀어 넣기 인터랙션(4번) 미구현
- 3D 모델: Sketchfab GLB 받으면 `frontend/public/models/` 에. 서랍장 외형만 교체하고 긴 서랍/파일 연출은 유지 (라이선스·출처 표기 확인)
- 백엔드: 인증(JWT), 벡터 검색, Prisma 스키마 — 아직 없음
