import { CanvasTexture, MeshPhysicalMaterial, RepeatWrapping, SRGBColorSpace } from "three";

/* 절차적 텍스처 — 분체도장 강판의 오렌지 필, 헤어라인 금속, 종이 섬유. 외부 이미지 없이 캔버스로 만든다 */
function noise(size: number, repeat: number, fn: (x: number, y: number) => number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(255, fn(x, y) * 255));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

function build() {
  const peel = noise(256, 3, () => 0.5 + (Math.random() - 0.5) * 0.5);
  const rows = Array.from({ length: 256 }, () => Math.random());
  const brushed = noise(256, 1, (_, y) => 0.4 + rows[y] * 0.4 + Math.random() * 0.08);
  const fiber = noise(256, 2, () => (Math.random() < 0.02 ? 0.2 : 0.55 + Math.random() * 0.2));

  return {
    steel: new MeshPhysicalMaterial({
      color: "#eef0f2",
      roughness: 0.55,
      roughnessMap: peel,
      bumpMap: peel,
      bumpScale: 0.4,
      clearcoat: 0.3,
      clearcoatRoughness: 0.35,
    }),
    metal: new MeshPhysicalMaterial({ color: "#d6dadf", metalness: 1, roughness: 0.28, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.2 }),
    dark: new MeshPhysicalMaterial({ color: "#2b2e33", metalness: 0.7, roughness: 0.4 }),
    manila: new MeshPhysicalMaterial({ color: "#d9c28f", roughness: 0.85, bumpMap: fiber, bumpScale: 0.3 }),
    paper: new MeshPhysicalMaterial({ color: "#faf8f2", roughness: 0.92, bumpMap: fiber, bumpScale: 0.15 }),
    // 인스턴스 폴더용 — 색은 instanceColor 로 폴더마다 준다
    folder: new MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.88, bumpMap: fiber, bumpScale: 0.2 }),
  };
}

let cache: ReturnType<typeof build> | undefined;
// Canvas 안(클라이언트)에서만 호출된다
export const materials = () => (cache ??= build());

/* 인쇄된 라벨 — 글자를 캔버스에 찍어 텍스처로. Html 과 달리 서랍에 가려진다 */
const labels = new Map<string, MeshPhysicalMaterial>();
export function labelMaterial(text: string, bg = "#faf8f2") {
  let mat = labels.get(text + bg);
  if (!mat) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "rgba(33,37,41,.75)";
    ctx.font = '600 56px "Courier New", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "8px";
    ctx.fillText(text, 256, 68);
    const map = new CanvasTexture(c);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 8;
    mat = new MeshPhysicalMaterial({ map, roughness: 0.9 });
    labels.set(text + bg, mat);
  }
  return mat;
}
