import { PerspectiveCamera, Vector3 } from "three";

/* 서류함 치수(월드 단위). ponytail: 절차적 박스 모델 — public/models/ 에 GLB 들어오면 useGLTF 로 교체 */
export const CABINET = {
  W: 1.5, // 폭
  H: 0.62, // 서랍 전면 높이
  D: 1.3, // 깊이
  GAP: 0.05, // 서랍 사이 틈
  T: 0.05, // 외곽 판 두께
};

// 서랍 i(0 = 맨 위)의 중심 y
export const drawerY = (i: number) => (1 - i) * (CABINET.H + CABINET.GAP);

// 내부 절반 높이 — 외곽 판 안쪽
export const INNER_HALF = 1.5 * CABINET.H + 2 * CABINET.GAP;

// 서랍 전면이 닫혔을 때의 z, 쫙 펼쳐졌을 때 빠지는 거리
export const FRONT_Z = CABINET.D / 2 - 0.02;
export const FULL_OPEN = 7.2; // 끝없이 길게 — 브루스 올마이티의 서랍. 카메라를 당긴 만큼 줄여 빠진 서랍 앞면이 화면 안에 남게

// 고정 카메라 — 서랍 정면, 살짝 위에서. 순백의 공간 저 멀리 서류함이 서 있다
export const CAMERA = new Vector3(0, 1.96, 11.6); // LOOK 쪽으로 20% 당김 — 넓은 프레임에서 서류함이 작아 보여서
export const LOOK = new Vector3(0, 0.2, 2);

// 파일이 떠오르는 자리 — 카메라 앞 5.5 유닛, 서류함이 보이게 살짝 위
export const PRESENT = CAMERA.clone().add(LOOK.clone().sub(CAMERA).normalize().multiplyScalar(5.5)).add(new Vector3(0, 0.45, 0));

// 떠오른 파일의 확대 배율
export const PRESENT_SCALE = 1.5;
const folderW = CABINET.W - 0.3;
const CARD_SPAN = (folderW * PRESENT_SCALE) / (2 * PRESENT.distanceTo(CAMERA)); // 파일 폭 / (2 × 거리)

/* 카메라 화각(세로 기준, 도). 넓은 화면은 30. 세로 화면(폰)은 좌우가 잘려 떠오른 파일이 화면 밖으로 나가니,
   파일 폭이 화면 폭의 CARD_FIT 을 넘지 않을 만큼 화각을 넓힌다(카메라를 뒤로 뺀 것과 같은 구도) */
export const FOV = 30;
const CARD_FIT = 0.8;
export const fovFor = (aspect: number) => Math.max(FOV, (2 * Math.atan(CARD_SPAN / (CARD_FIT * aspect)) * 180) / Math.PI);

// 화면 세로 위치(% from top) — 카메라가 고정이고 시선 위의 점이라 화면비와 무관하고 화각만 탄다
const probe = new PerspectiveCamera(FOV, 1);
probe.position.copy(CAMERA);
probe.lookAt(LOOK);
function screenTop(p: Vector3, fov: number) {
  probe.fov = fov;
  probe.updateProjectionMatrix();
  probe.updateMatrixWorld();
  return ((1 - p.clone().project(probe).y) / 2) * 100;
}
/** 떠오른 파일의 화면 세로 위치(%) — 입력칸이 여기 뜬다 */
export const presentTop = (fov: number) => screenTop(PRESENT, fov);
/** 서류함 중심의 화면 세로 위치(%) — 로딩 후광이 여기서 번진다 */
export const cabinetTop = (fov: number) => screenTop(new Vector3(), fov);
/** 떠오른 파일의 폭이 화면 높이의 몇 % 인지 — 입력칸 크기를 여기에 맞춘다 */
export const cardVh = (fov: number) => (CARD_SPAN / Math.tan((fov * Math.PI) / 360)) * 100;
