---
name: design-rules
description: 화면을 새로 만들거나 고칠 때 따르는 디자인 규칙 — AI 티 나는 디자인 피하기, 4/8px 격자·대비·접근성, 모션 길이·easing·reduced motion. 버튼·폼·안내·오버레이 같은 UI 를 만들거나 다듬을 때, "디자인 규칙", "디자인 스킬" 이라고 할 때.
---

# 디자인 규칙

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
