/* 감열지에 찍힌 듯한 플로피 디스크 그림 — 영수증 인쇄기는 회색을 못 내서 가로줄 간격으로 명암을 낸다(10/2 사용자 레퍼런스: 신발 사진 영수증).
   SVG 를 data URL 로 — Satori 가 <img> 로 그린다. 진한 곳(몸체)은 줄이 촘촘, 밝은 곳(라벨)은 성기게. 줄은 군데군데 끊겨 인쇄가 번진 느낌 */

const INK = "#26262a";

/** 줄 무늬 — gap 이 클수록 밝다. 다섯 줄을 한 묶음으로, 줄마다 끊기는 자리를 들쭉날쭉하게 — 같으면 세로 줄무늬, 일정하게 밀면 사선 계단이 보였다 */
const lines = (id: string, gap: number, w: number, dash: string) =>
  `<pattern id="${id}" width="613" height="${gap * 5}" patternUnits="userSpaceOnUse">${[0, 1, 2, 3, 4]
    .map((r) => `<path d="M0 ${gap * r + gap / 2}H613" stroke="${INK}" stroke-width="${w}" stroke-dasharray="${dash}" stroke-dashoffset="${[11, 53, 29, 71, 4][r]}"/>`)
    .join("")}</pattern>`;

/** 플로피 한 장(300×300 기준) — 몸체·셔터·셔터 구멍·라벨·쓰기 방지 구멍·모서리 깎임. 셔터·라벨은 종이색을 먼저 깔아야 밑의 몸체 줄이 안 비친다 */
const floppy = (x: number, y: number, rot: number) => `
<g transform="translate(${x} ${y}) rotate(${rot} 150 150)">
  <path d="M0 14Q0 0 14 0H262L300 38V286Q300 300 286 300H14Q0 300 0 286Z" fill="url(#dark)"/>
  <rect x="78" y="0" width="150" height="112" fill="#f7f6f2"/><rect x="78" y="0" width="150" height="112" fill="url(#mid)"/>
  <rect x="168" y="16" width="34" height="78" fill="url(#dark)"/>
  <rect x="34" y="150" width="232" height="138" fill="#f7f6f2"/><rect x="34" y="150" width="232" height="138" fill="url(#light)"/>
  <rect x="34" y="150" width="232" height="22" fill="url(#mid)"/>
  <rect x="270" y="262" width="18" height="22" fill="#f7f6f2"/>
</g>`;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="360" viewBox="0 0 620 360">
<defs>${lines("dark", 2.6, 2.1, "41 3")}${lines("mid", 5, 1.3, "23 4 9 3")}${lines("light", 10, 0.8, "17 7 5 5")}</defs>
${floppy(40, 40, -8)}${floppy(270, 30, 7)}
</svg>`;

export const THERMAL_FLOPPY = `data:image/svg+xml;base64,${btoa(SVG)}`; // btoa — 서버(카드)와 브라우저(공유 페이지) 둘 다
