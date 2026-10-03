---
paths:
  - "frontend/**"
  - "docs/ui-ux-spec.md"
  - "docs/voice-persona.md"
---

# 화면·문구

- 화면 명세는 `docs/ui-ux-spec.md` 가 기준. 화면을 바꾸면 명세도 같이 고친다.
- 자막(목소리로 나오는 대사·검증 꾸지람)은 `docs/voice-persona.md` 페르소나 — 브루스 올마이티의 신, "자네", ~게/~네/~지.
  **버튼·링크·화면 안내 글은 평범한 말투**(버튼은 짧은 동사형, 안내는 ~요) — 10/2 사용자.
  문구는 `components/landing/lines.ts` 에 모으고, 음성이 필요하면 `docs/voice-script.csv` 에 영어 대본을 추가하고 `backend` 에서 `npm run voice`(녹음 없는 줄만 ElevenLabs 로 만들어 `public/voice` 에 저장).
- 3번(편지) 화면: "신" 같은 직접적인 단어 금지. 순백과 그림자색만, 따뜻한 색 금지.
- 4·5번 방: 검은 배경 + 흰 서류함(랜딩과 같은 치수·재료). 위아래는 어둠에 잠기고 좌우는 틈 없이 촘촘히.
- 일반 UI 는 `.claude/skills/design-rules` — 버튼 `.btn`/`.btn-solid` 두 가지, 아이콘 Phosphor, 포커스 표시, 화면 글 em-dash 금지.
  3D·CSS 모션은 감속 모드(`useReducedMotion`)를 지키고, 쉬는 동안 렌더하지 않는다.
- 조명은 눈부시지 않게 — 디스크 라벨이 반사에 묻히면 조명을 낮추고 재질을 무광으로.
