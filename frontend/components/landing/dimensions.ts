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
export const FULL_OPEN = 9; // 끝없이 길게 — 브루스 올마이티의 서랍

// 고정 카메라 — 순백의 공간 저 멀리 서류함이 서 있다
export const CAMERA = new Vector3(2.4, 1.6, 13);
export const LOOK = new Vector3(0, 0.1, 0);

// 파일이 떠오르는 자리 — 카메라 앞 5.5 유닛, 서류함이 보이게 살짝 위
export const PRESENT = CAMERA.clone().add(LOOK.clone().sub(CAMERA).normalize().multiplyScalar(5.5)).add(new Vector3(0, 0.45, 0));

// 떠오른 파일의 화면 세로 위치(% from top). 카메라가 고정이고 파일이 시선 위에 있어 화면비와 무관하다
const probe = new PerspectiveCamera(30, 1);
probe.position.copy(CAMERA);
probe.lookAt(LOOK);
probe.updateMatrixWorld();
export const PRESENT_TOP = ((1 - PRESENT.clone().project(probe).y) / 2) * 100;

// 떠오른 파일의 확대 배율과, 그때 파일 폭이 화면 높이의 몇 vh 인지 — 입력칸 크기를 여기에 맞춘다
export const PRESENT_SCALE = 1.6;
const folderW = CABINET.W - 0.3;
export const CARD_VH = ((folderW * PRESENT_SCALE) / (2 * PRESENT.distanceTo(CAMERA) * Math.tan((15 * Math.PI) / 180))) * 100;
