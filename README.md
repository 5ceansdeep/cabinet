# cabinet

자연어로 상황과 감정을 적으면, 서류함 속에서 그에 맞는 음악을 건져 올려 주는 웹 앱.

UI/UX 전체 스펙은 [docs/ui-ux-spec.md](docs/ui-ux-spec.md)에 있다. 화면 구성과 연출은 전부 그 문서를 기준으로 한다.

## 구조

```
frontend/   Next.js (App Router) + TypeScript + Tailwind + React Three Fiber
backend/    NestJS + Prisma
docs/       스펙 문서
```

## 개발

```bash
# 프론트엔드
cd frontend && npm run dev     # http://localhost:3000

# 백엔드
cd backend && npm run start:dev
```

## 스택

- **frontend**: Next.js, React Three Fiber / drei / postprocessing, zustand, Tailwind
- **backend**: NestJS, Prisma, JWT 인증
