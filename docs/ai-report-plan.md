# 아키비스트 AI 보고서 (XAI) 추가 계획

## Context
결과(4-1)와 아카이브(5.1)에서 "87%" 점수만 보여주지 말고, **왜 이 곡을 골랐는지**를 빈티지 보고서 문체로 타자기처럼 한 줄씩 인쇄하고 싶음.
핵심 원칙: **숫자는 백엔드가 계산하고, LLM은 문장만 쓴다.** LLM에 숫자까지 맡기면 "91.2%" 같은 그럴듯한 가짜 근거가 나와서 XAI가 아니게 됨.

현재 상태:
- 백엔드(`backend/src`)는 Nest 빈 뼈대뿐. DB·벡터 검색·인증 없음.
- 결과 트랙은 `frontend/components/results/tracks.ts` 하드코딩 (semantic, mood 점수만).
- 타자기 인쇄는 `components/results/Disk.tsx`의 setInterval + slice 패턴, "탁" 소리는 `lib/thud.ts`에 이미 있음.

## 오디오 특징(Audio Feature)이란
곡 소리를 숫자로 요약한 값. 보고서의 "근거"가 되는 재료.

| 특징 | 뜻 | 예 |
|---|---|---|
| BPM(템포) | 빠르기 | 72 BPM = 느긋함 |
| Key / Mode | 조성, 장조/단조 | A단조 = 어두운 색 |
| Energy | 소리 세기·밀도 | 0.3 = 잔잔 |
| Valence | 밝음↔슬픔 | 0.2 = 우울 쪽 |
| Acousticness | 어쿠스틱 정도 | 0.8 = 통기타·피아노 |
| Timbre / 공간감 | 음색, 리버브 양 (MFCC, spectral centroid 등) | 리버브 많음 = 몽환 |
| 가사 벡터 | 가사 의미를 임베딩한 값 | '밤', '혼자' 쪽 |

어디서 얻나:
- Spotify Audio Features API는 2024년 11월부터 신규 앱에 막힘 → 못 씀.
- **추천: 직접 분석.** iTunes Search API의 30초 미리듣기(무료, 키 없음)를 받아 Python `librosa`로 한 번씩 분석해서 JSON으로 저장 (오프라인 배치, 서버 아님).
- 가사: 저작권 문제 있음 → 1차에선 제외, 곡 설명/태그 텍스트로 대체.

## "고독·공간감 축" 진짜로 만들기
768차원 벡터엔 원래 축 이름이 없음. 그래서:
1. '고독', '공간감', '향수', '설렘' 같은 **기준 단어 N개를 미리 임베딩**해 둠.
2. 요청 문장 벡터와 각 기준 단어의 코사인 유사도 계산 → 상위 2~3개가 "편향된 축".
3. 곡 쪽도 같은 방식 → 겹치는 축 = 선정 이유.
- 임베딩 모델: `multilingual-e5-base` (768차원, 한국어 가능) — Node에서 `@huggingface/transformers`로 백엔드 안에서 바로 돌림. 파이썬 서버 없이.

## 단계

### 1단계 — 가짜 숫자로 보고서 흐름부터 (지금 프로젝트 방식과 동일)
**백엔드**
- `npm i @anthropic-ai/sdk` (backend).
- `backend/src/report/report.controller.ts` + `report.service.ts` (새 모듈 1개, `app.module.ts`에 등록).
  - `POST /reports` body `{ query, track: { title, artist, scores, features, axes } }` → SSE로 텍스트 조각 흘려보냄.
  - `client.messages.stream(...)` → `text` 이벤트마다 `res.write`. 끝나면 `finalMessage()`의 `stop_reason` 확인.
  - 모델 `claude-opus-5`, `output_config: { effort: "low" }` (첫 글자 빨리 — 타자기 연출용), `max_tokens` 넉넉히.
  - 시스템 프롬프트: 보고서 문체 규칙 + 예시 보고서 2~3개 + "입력에 없는 숫자 금지, 입력 숫자만 인용". 고정 문자열 → `cache_control` (길이가 최소 캐시 크기 넘을 때만 실제로 캐시됨).
  - ponytail: 생성 결과 `(query, trackId)` 키로 메모리 Map 캐시 → Prisma 생기면 DB 테이블로.
  - `ANTHROPIC_API_KEY`는 `backend/.env` (이미 gitignore됨). 프론트엔 절대 안 둠.
  - CORS: `main.ts`에 `app.enableCors({ origin: "http://localhost:3000" })`.
- `tracks.ts`에 곡별 가짜 `features`/`axes` 추가 (ponytail 주석).

**프론트**
- `components/report/Report.tsx`: fetch 스트림 읽어서 받은 글자를 큐에 쌓고, Disk.tsx와 같은 setInterval 방식으로 한 글자씩 출력, 줄마다 `thud()`로 "탁". 종이 보고서 스타일(Fragment Mono).
- `app/report/page.tsx` — `/report?q=...&track=1`. 5.1에서도 그대로 재사용.
- 4-1 진입: 디스크 라벨 아래 "REPORT" 링크 (더블클릭=재생은 그대로).

### 2단계 — 진짜 오디오 특징
- `scripts/analyze.py` (오프라인 1회): iTunes 미리듣기 받기 → librosa로 BPM/Key/Energy/음색/리버브 추정 → `backend/data/features.json`.
- 백엔드가 가짜 대신 이 JSON 읽음.

### 3단계 — 진짜 축 분석 + 점수
- 백엔드에 e5 임베딩 + 기준 단어 축 계산 → `axes`, `semantic` 점수를 실제 값으로.
- 벡터 검색 API 생기면 `tracks.ts` 가짜 데이터 제거.

## 결정 필요 (기본값으로 진행, 바꾸려면 말해)
- 모델: 기본 `claude-opus-5` ($5/$25 per 1M). 싸게 가려면 `claude-sonnet-5` ($2/$10), `claude-haiku-4-5` ($1/$5).
- 1차 범위: 1단계만 (가짜 숫자로 보고서 UI+스트리밍 완성).

## 파일
- 새로: `backend/src/report/report.{controller,service}.ts`, `frontend/components/report/Report.tsx`, `frontend/app/report/page.tsx`
- 수정: `backend/src/app.module.ts`, `backend/src/main.ts`(CORS), `frontend/components/results/{tracks.ts,Disk.tsx}`, `docs/ui-ux-spec.md`(4-1·5.1에 보고서 섹션), `CONTEXT.md`
- 재사용: `frontend/lib/thud.ts`, Disk.tsx 타자기 패턴

## 검증
- `cd backend && npx tsc --noEmit`, `cd frontend && npx tsc --noEmit -p .` + eslint.
- `curl -N -X POST localhost:4000/reports -H "content-type: application/json" -d '{...}'` → 조각이 스트리밍되는지, 입력에 없는 숫자가 안 나오는지 눈으로 확인.
- 브라우저: `/results?q=...` → REPORT → 한 줄씩 인쇄 + "탁". 같은 곡 다시 열면 캐시로 즉시.
- 키 없을 때: 백엔드가 에러 메시지를 보고서 대신 "보관소 연결 실패" 문구로 돌려주는지.
