---
paths:
  - "frontend/components/**"
---

# 3D (React Three Fiber)

- 3D 는 R3F 로 만든다. CSS 3D 로 흉내 내지 않는다(랜딩·결과·보관함이 같은 기술·같은 서류함이어야 한다).
  서류함 치수는 `landing/dimensions.ts`, 재료는 `landing/materials.ts`, 둘러선 벽은 `results/CabinetWall.tsx` 의 `Wall` 을 재사용.
- `materials()`·`labelMaterial()`·캔버스 텍스처는 `<Canvas>` 안의 자식 컴포넌트에서만 만든다.
  캔버스 밖(페이지 컴포넌트 본문)에서 부르면 서버 렌더에 `document` 가 없어 500 이 난다.
- 화면 좌표는 아래가 +y, 3D 는 위가 +y — 포인터 속도를 월드 속도로 바꿀 때 부호를 뒤집는다.
- `frameloop="demand"` 장면은 움직이는 동안 `useFrame` 끝에서 `invalidate()` 를 불러야 계속 그려진다.
- 매 프레임 바뀌는 물리 상태는 리액트 밖(모듈 Map)에 두고, 목록이 바뀔 때만 setState. 물체 위치는 `useFrame` 에서 매 프레임 옮겨 준다.
- 드래그가 물체 밖으로 나가도 끊기지 않게 포인터 이동은 `window` 에서 듣는다.
- `<Canvas onCreated>` 에서 `webglcontextlost` 를 `preventDefault` 해야 컨텍스트가 되살아난다.
