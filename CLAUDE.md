# cabinet

- 세션 시작 시 루트의 `CONTEXT.md`를 읽고 이전 작업 상태를 이어간다. 작업을 마칠 때 갱신한다.
- UI/UX는 전부 [docs/ui-ux-spec.md](docs/ui-ux-spec.md) 기준.
- 자막·안내·검증 문구 등 사용자에게 보이는 모든 텍스트는 [docs/voice-persona.md](docs/voice-persona.md) 페르소나(브루스 올마이티의 신, "자네", ~게/~네/~지)를 따른다.
- 루트에서 `npm run dev` → 프론트 :3000 + 백엔드 :4000.
- 커밋 메시지는 DRIFT 레포 컨벤션: `[TYPE] 한국어 요약 — 부연` (TYPE: FEAT·FIX·DOCS·REFACTOR·PERF·CLEAN·REDESIGN), 본문은 `-` 목록 또는 원인·해결 서술. 기능별로 나눠 커밋.

## frontend

@frontend/AGENTS.md
