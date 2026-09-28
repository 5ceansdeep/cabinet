---
paths:
  - "frontend/**"
  - "backend/**"
---

# 검증

- 끝났다고 하기 전에: 프론트 `npx tsc --noEmit -p .` + `npx eslint components app lib`, 백엔드 `npx tsc --noEmit -p tsconfig.json` + `npm run lint` + `npm test`. 출력이 크면 `test-runner` 에이전트에 맡긴다.
- 화면·애니메이션을 바꿨으면 헤드리스 크롬으로 스크린샷을 찍어 눈으로 확인한다(`/visual-check` 스킬). 수치만 보고 "됐다"고 하지 않는다.
- 백엔드 권한·검증을 바꿨으면 다른 포트에 띄워 curl 로 막힐 것과 통과할 것을 둘 다 확인한다(`/backend-smoke` 스킬).
- 검증용으로 설치한 도구(puppeteer-core 등)는 끝나면 `npm uninstall` 로 지운다.
- 확인하려고 켠 개발 서버는 끝나면 끈다.
