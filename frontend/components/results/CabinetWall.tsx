/* 4번 배경 — 랜딩의 서류함과 같은 생김새(라벨 홀더 + 손잡이 + 금속 몸통)로,
   화면 높이를 넘겨 위아래가 안 보이게 선 벽. 시야를 둥글게 감싼다.
   CSS 3D 만으로 만든다(기둥을 rotateY + translateZ 로 원통에 둘러세움) — 3D 캔버스를 하나 더 띄우면 무겁다 */

const PILLARS = 13; // 둘러세울 기둥 수(홀수 — 가운데가 정면)
const STEP = 13; // 기둥 사이 각도
const RADIUS = 1400; // 시야에서 벽까지
const DRAWERS = 7; // 기둥 한 줄의 서랍 수 — 화면 위아래로 넘치게

function Drawer() {
  return (
    <div className="relative flex-1 rounded-[3px] bg-[linear-gradient(#232a38_0%,#1a2130_18%,#151b27_82%,#0f141d_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_2px_6px_rgba(0,0,0,.5)]">
      {/* 라벨 홀더 — 금속 테 안에 종이 라벨 (랜딩과 같은 자리) */}
      <div className="absolute top-[24%] left-1/2 h-[16%] w-[42%] -translate-x-1/2 rounded-[2px] bg-[#2b3344] p-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]">
        <div className="size-full rounded-[1px] bg-[#39435a]/70" />
      </div>
      {/* 손잡이 */}
      <div className="absolute bottom-[22%] left-1/2 h-[9%] w-[40%] -translate-x-1/2 rounded-full bg-[linear-gradient(#3a4356,#232b3a)] shadow-[0_1px_2px_rgba(0,0,0,.6)]" />
    </div>
  );
}

function Pillar({ angle }: { angle: number }) {
  return (
    <div
      className="absolute top-1/2 left-1/2 flex h-[190vh] w-[340px] flex-col gap-[6px]"
      style={{ transform: `translate(-50%,-50%) rotateY(${angle}deg) translateZ(-${RADIUS}px)` }}
    >
      {/* 몸통 옆판 */}
      <div className="absolute inset-y-0 -left-2 w-2 bg-[#0d121b]" />
      <div className="absolute inset-y-0 -right-2 w-2 bg-[#0d121b]" />
      {Array.from({ length: DRAWERS }, (_, i) => (
        <Drawer key={i} />
      ))}
    </div>
  );
}

export default function CabinetWall() {
  const half = (PILLARS - 1) / 2;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden bg-background [perspective:1200px]">
      <div className="absolute inset-0 [transform-style:preserve-3d]">
        {Array.from({ length: PILLARS }, (_, i) => (
          <Pillar key={i} angle={(i - half) * STEP} />
        ))}
      </div>
      {/* 위아래는 어둠에 잠겨 벽이 끝없이 이어져 보인다 */}
      <div className="absolute inset-0 bg-[linear-gradient(#0a0d14_0%,rgba(10,13,20,.55)_16%,transparent_34%,transparent_66%,rgba(10,13,20,.6)_84%,#0a0d14_100%)]" />
      {/* 가운데만 은은하게 밝다 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,rgba(0,229,255,.06),transparent_58%)]" />
    </div>
  );
}
