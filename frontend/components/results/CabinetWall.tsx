/* 4번 배경 — 화면 높이만큼 큰 서류함이 시야를 둥글게 감싼다.
   CSS 3D 만으로 만든다(기둥을 rotateY + translateZ 로 원통에 둘러세움). 3D 캔버스를 하나 더 띄우면 무겁다 */

const PILLARS = 11; // 가운데 기준 좌우로 펼칠 기둥 수(홀수)
const STEP = 15; // 기둥 사이 각도
const RADIUS = 1500; // 시야에서 벽까지
const DRAWERS = 5; // 기둥 한 줄의 서랍 수

function Pillar({ angle }: { angle: number }) {
  return (
    <div
      className="absolute top-1/2 left-1/2 flex h-[100vh] w-[320px] -translate-x-1/2 -translate-y-1/2 flex-col gap-2 px-1"
      style={{ transform: `translate(-50%,-50%) rotateY(${angle}deg) translateZ(-${RADIUS}px)` }}
    >
      {Array.from({ length: DRAWERS }, (_, i) => (
        <div
          key={i}
          className="relative flex-1 rounded-[3px] border border-white/5 bg-[linear-gradient(#171c28,#10141d_60%,#0d111a)] shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
        >
          {/* 라벨 홀더 */}
          <div className="absolute top-[26%] left-1/2 h-[14%] w-[38%] -translate-x-1/2 rounded-[2px] bg-[#1f2532] shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]" />
          {/* 손잡이 */}
          <div className="absolute bottom-[24%] left-1/2 h-[7%] w-[36%] -translate-x-1/2 rounded-full bg-[linear-gradient(#2b3243,#1a1f2b)]" />
        </div>
      ))}
    </div>
  );
}

export default function CabinetWall() {
  const half = (PILLARS - 1) / 2;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden bg-background [perspective:1100px]">
      <div className="absolute inset-0 [transform-style:preserve-3d]">
        {Array.from({ length: PILLARS }, (_, i) => (
          <Pillar key={i} angle={(i - half) * STEP} />
        ))}
      </div>
      {/* 위아래로 어둠이 깔려 벽이 끝없이 이어져 보인다 */}
      <div className="absolute inset-0 bg-[linear-gradient(#0a0d14_2%,transparent_28%,transparent_72%,#0a0d14_98%)]" />
      {/* 가운데만 은은하게 밝다 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(0,229,255,.07),transparent_55%)]" />
    </div>
  );
}
