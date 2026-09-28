---
paths:
  - "frontend/**"
---

# 프론트엔드 (Next.js 16)

- 이 Next.js 는 학습한 것과 다르다. 코드를 쓰기 전에 `frontend/node_modules/next/dist/docs/` 의 해당 가이드를 읽고 deprecation 안내를 따른다.
- `frontend/AGENTS.md` 는 `next dev` 가 다시 만들어 넣는 파일이다. 지우거나 고치지 말고, 바뀌면 그대로 커밋한다.
- `app/` 은 라우트와 페이지 상태 흐름만. UI 조각은 `components/<화면>/`, 공용 유틸은 `lib/`.
- 가짜 데이터·임시 구현에는 `ponytail:` 주석으로 한계와 교체 방법을 적는다.
- 린트(React 컴파일러 규칙)가 엄격하다: 렌더 중 ref 읽기 금지, useState 값 직접 변경 금지.
