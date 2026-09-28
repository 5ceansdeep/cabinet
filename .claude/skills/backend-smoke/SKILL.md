---
name: backend-smoke
description: 백엔드 권한·검증·설정을 바꾼 뒤 별도 포트(4099)에 띄워 curl 로 막힐 요청과 통과할 요청을 둘 다 확인하는 절차. 인증·가드·DTO 제한·필수 환경변수 변경 검증에.
---

# 백엔드 스모크 테스트

개발 서버(:4000)는 건드리지 않고 빌드본을 4099 에 따로 띄운다.

1. `backend` 에서 준비: `.env` 가 없으면 `cp .env.example .env`(값은 사용자에게 채워 달라고 한다),
   `npx prisma generate`, `npx prisma migrate deploy`, `npx nest build`.
2. 필수 환경변수가 없을 때 멈추는지: `.env` 없는 임시 폴더에서 `PORT=4099 node <backend>/dist/main.js` →
   "Configuration key ... does not exist" 로 멈춰야 한다.
3. 띄우기: `(ADMIN_EMAILS=boss@cabinet.kr PORT=4099 node dist/main.js > /tmp/be.log 2>&1 &)` 후 몇 초 대기.
4. 토큰: `POST /auth/signup` 으로 일반 계정·관리자 계정을 만들어 `accessToken` 을 꺼낸다(node 로 JSON 파싱 — jq 없음).
5. 막힐 것과 통과할 것을 둘 다 찍는다. 예(곡 수집):
   - 토큰 없이 → 401, 일반 계정 → 403, 관리자 + 한도 초과 → 400, 관리자 정상 → 201.
6. 끄기: `Get-NetTCPConnection -LocalPort 4099 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`.
7. 결과는 "요청 → 기대 → 실제 코드" 표로 보고한다. DB 가 원격(Neon)이라 테스트 계정도 모든 PC 에 보인다 — 끝나면 지운다.
