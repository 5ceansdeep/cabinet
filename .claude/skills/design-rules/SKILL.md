---
name: design-rules
description: 화면을 새로 만들거나 고칠 때 따르는 디자인 규칙 — AI 티 나는 디자인 피하기, 4/8px 격자·대비·접근성, 모션 길이·easing·reduced motion. 버튼·폼·안내·오버레이 같은 UI 를 만들거나 다듬을 때, "디자인 규칙", "디자인 스킬" 이라고 할 때.
---

# 디자인 규칙

## 이 프로젝트에서의 범위 (10/3 사용자: 컨셉 유지 + 정리)
- 아래 규칙은 **일반 UI**(버튼·링크·안내·오버레이·폼·404/오류 화면)에 그대로 적용한다.
- **컨셉 예외** — `docs/ui-ux-spec.md` 가 우선: 3D 연출의 길이와 결(서랍 빠짐·카드 비행·쾅 닫힘·후광·벽 뒤지기·던지기 물리),
  편지지 등장 1.6초·카드 인쇄 1.1초, 컨셉 글꼴(나눔명조·조선굴림·고정폭), 시안 강조색 `#00e5ff`·자막 노랑, 대문자 고정폭 서류 라벨,
  공개 서랍(/s)·공유 카드의 영수증 디자인. 500ms 상한은 일반 UI 전환에만.
- **예외 없이 지키는 것**: 감속 모드(prefers-reduced-motion — 3D 포함, `lib/motion.ts` 의 `useReducedMotion`),
  쉬는 동안 렌더하지 않기(R3F `frameloop="demand"` + 움직일 때만 `invalidate`), 프레임 속도와 무관한 감쇠(`1 - exp(-r·dt)`),
  `useFrame` 안 할당 금지, 포커스 표시, WCAG AA 대비, 화면 글 em-dash 금지.
- 버튼은 `globals.css` 의 `.btn`(테두리 알약)·`.btn-solid`(주 행동 하나) 두 가지. 패널·시트·입력은 반경 8px. 아이콘은 `@phosphor-icons/react` 만.

# 1. Taste Skill (Anti-AI Slop Rules)
- Avoid generic AI design tropes: bright purple/neon blue gradients on dark backgrounds, excessive glassmorphism, or floating glow effects.
- Use restrained color palettes: 1 primary accent color maximum, with warm/cool neutral grays.
- Keep border radii consistent across components (e.g., strictly 6px or 8px).
- Typography: Use clean sans-serif fonts (Inter, Pretendard, Geist). Maintain strict typographic scale and line-heights.

# 2. UI/UX Pro Max Rules
- Layout: Use a strict 4px/8px grid system for all padding, margins, and gaps.
- Responsive Design: Mobile-first approach with max content width capped at 1200px. Standard container padding (16px mobile, 24px desktop).
- Color System: Ensure contrast ratio satisfies WCAG AA (minimum 4.5:1 for standard text). Define CSS/Tailwind tokens for background, foreground, border, primary, and muted states.
- Accessibility: Always include focus-visible states, semantic HTML tags, and ARIA attributes for interactive elements.

# 3. Design Motion Principles
- Duration: Micro-interactions (100ms–150ms), UI transitions (200ms–300ms), modal/drawer entrances (300ms–400ms). Never exceed 500ms.
- Easing: Use natural cubic-bezier curves (e.g., `cubic-bezier(0.16, 1, 0.3, 1)` for springy slide-ins). Never use `linear` for layout transforms.
- Performance: Only animate GPU-accelerated CSS properties (`transform`, `opacity`). Never animate `width`, `height`, `top`, or `margin`.
- Reduced Motion: Always respect `@media (prefers-reduced-motion: reduce)` to disable heavy layout transitions.
