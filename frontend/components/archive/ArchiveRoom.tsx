"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CaretDown, CaretLeft, CaretRight, CaretUp } from "@phosphor-icons/react";
// import { useRouter } from "next/navigation"; // 보고서 꺼 둠 — 디스크를 눌러 보고서로 갈 때 쓴다
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Vector3, type Group, type PointLight } from "three";
import { CABINET } from "@/components/landing/dimensions";
import { labelMaterial, materials } from "@/components/landing/materials";
import { Wall } from "@/components/results/CabinetWall";
import { DISK, FloppyBody, useLabel } from "@/components/results/floppy";
import type { Track } from "@/components/results/tracks";
import { thud } from "@/lib/thud";
import { keepContext } from "@/lib/gl";
import { damp, useReducedMotion } from "@/lib/motion";
import { ARCHIVE_DIALOGUE, PLAYLIST_DIALOGUE } from "@/components/landing/lines";
import CardReveal from "@/components/share/CardReveal";
import ListenPanel from "./ListenPanel";
import TrackSheet from "./TrackSheet";
import { parseShelves, shelvesRaw, subscribeShelves, syncShelves } from "./shelf";

/* 5번 아카이빙 메인 룸 — 나만의 서류함. 서랍 전면에 감정 테마 태그가 네임택으로 붙어 있고,
   서랍을 누르면 앞으로 열리며 카메라가 위로 올라가 안을 내려다본다(Top-down).
   모은 플로피가 종이 파일 사이에 가지런히 꽂혀 있다. 방(둘러선 벽)은 4번과 같은 것을 쓴다 */

const { W, H, D, T, GAP } = CABINET;
const OPEN = 0.8; // 서랍이 빠지는 거리 — 안에 꽂힌 디스크가 보일 만큼(앞면 ≈1.4, 펼친 디스크 2.0 보다 뒤)
const PER_PAGE = 3; // 서류함 한 짝에 서랍 3개
const FRONT = new Vector3(0, 0, 3.2); // 서류함을 정면에서
const ENTER = 0.5; // 칸을 넘기면 새 서랍이 이만큼(월드) 넘긴 쪽에서 밀려 들어온다 — 아래 서랍일수록 조금 더 멀리서(엇갈림)


/* 정면 조명 — 열린 서랍(z≈2.1) 바로 위에 놓여 안을 하얗게 날린다, 열면 줄인다(10/2). 툭 바뀌지 않고 서랍과 같은 빠르기로 */
function FrontLight({ dim }: { dim: boolean }) {
  const l = useRef<PointLight>(null!);
  const reduce = useReducedMotion();
  const { invalidate } = useThree();
  useEffect(() => invalidate(), [dim, invalidate]);
  useFrame((_, dt) => {
    const to = dim ? 1.5 : 6;
    if (Math.abs(l.current.intensity - to) < 0.01) return void (l.current.intensity = to);
    l.current.intensity += (to - l.current.intensity) * damp(6, dt, reduce);
    invalidate();
  });
  return <pointLight ref={l} position={[0, 0.6, 2.4]} intensity={6} distance={9} decay={2} color="#ffffff" />;
}

/* 펼쳐 놓은 플로피 한 장 — 연 서랍에서 날아와 정면을 보고 선다(10/3 사용자: 서랍 안을 내려다보는 대신 5장씩 두 줄로).
   from = 날아오는 자리(연 서랍 입구), at = 설 자리, delay = 차례(초) */
function Filed({
  track,
  from,
  fromScale,
  at,
  size,
  delay,
  onOpen,
}: {
  track: Track;
  from: [number, number, number]; // 서랍 안 제자리(월드)
  fromScale: number; // 서랍 안에선 이만큼 작게(1 = 펼친 크기)
  at: [number, number, number];
  size: number;
  delay: number; // 서랍 안에 이만큼(초) 꽂혀 있다가 꺼내진다
  onOpen: () => void;
}) {
  const { invalidate } = useThree();
  const label = useLabel(track, invalidate); // 커버가 도착하면 다시 그린다
  const [hover, setHover] = useState(false);
  const g = useRef<Group>(null!);
  const born = useRef(-1);
  const reduce = useReducedMotion();
  const [ax, , az] = at;
  useEffect(() => invalidate(), [hover, ax, az, invalidate]); // 호버·넘기기로 설 자리가 바뀌면 깨운다
  // 차례가 되면 서랍에서 날아와 자리에 서고, 호버하면 앞으로 쏙 나온다 — 순간 이동 없이(디자인 규칙: 상태 변화는 보이게)
  useFrame(({ clock }, dt) => {
    const p = g.current.position;
    if (born.current < 0) born.current = clock.elapsedTime;
    if (!reduce && clock.elapsedTime - born.current < delay) return void invalidate(); // 아직 서랍 안 — 비스듬히 꽂힌 채
    const k = damp(7, dt, reduce);
    g.current.rotation.x += (0 - g.current.rotation.x) * k; // 꺼내지며 정면으로 선다
    const tx = at[0];
    const ty = at[1] + (hover ? 0.04 : 0);
    const tz = at[2] + (hover ? 0.18 : 0);
    const sc = g.current.scale.x + (1 - g.current.scale.x) * k;
    g.current.scale.setScalar(sc);
    p.set(p.x + (tx - p.x) * k, p.y + (ty - p.y) * k, p.z + (tz - p.z) * k);
    if (Math.hypot(tx - p.x, ty - p.y, tz - p.z) < 5e-4 && sc > 0.999 && Math.abs(g.current.rotation.x) < 1e-4) {
      p.set(tx, ty, tz);
      g.current.scale.setScalar(1);
      g.current.rotation.x = 0;
    } else invalidate();
  });
  return (
    <group
      ref={g}
      position={reduce ? at : from}
      scale={reduce ? 1 : fromScale}
      rotation={[reduce ? 0 : -0.35, 0, 0]} // 서랍 안에선 종이 파일에 기대어 비스듬히
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <group scale={size}>
        <FloppyBody map={label.tex} />
      </group>
    </group>
  );
}

/* 연 서랍의 플로피를 서류함 앞에 한 줄로 늘어놓는다 — 결과 화면처럼 가운데 디스크가 앞에, 옆은 뒤로 물러나고 양옆으로 넘긴다
   (10/3 사용자: 서랍 안을 들여다보지 말고 평면으로, 추천 화면처럼). pick = 가운데 곡 번호 */
const SPREAD_Z = 2.0; // 가운데 디스크 깊이(카메라 3.2 앞) — 열린 서랍 앞면(≈1.4)보다 앞
const PEEK = 1.1; // 서랍이 열려 안의 디스크가 보이는 시간(초) — 그 뒤 하나씩 꺼내진다
const IN_ROW = 5; // 서랍 안 한 줄에 꽂힌 디스크 수
function Spread({ kept, pick, fromY, onPick, onOpenTrack }: { kept: Track[]; pick: number; fromY: number; onPick: (i: number) => void; onOpenTrack: (t: Track) => void }) {
  const { camera, size: px } = useThree();
  const fov = ((camera as unknown as { fov: number }).fov * Math.PI) / 180;
  const vh = 2 * (FRONT.z - SPREAD_Z) * Math.tan(fov / 2); // 가운데 깊이에서 보이는 높이
  const vw = vh * (px.width / px.height);
  const disk = Math.min(vh * 0.42, vw * 0.2); // 위 머리말·아래 듣기 버튼 자리를 남긴다
  const gap = disk * 1.12;
  // 서랍 안 자리 — 종이 파일 사이에 한 줄 IN_ROW 장, 넘치면 뒤 줄(예전 서랍 속 모습)
  const cols = Math.min(IN_ROW, kept.length);
  const step = Math.min(0.34, (W - 0.3) / cols);
  const inSize = Math.min(0.42, (step * 0.9) / DISK);
  return (
    <group>
      {kept.map((t, i) => {
        const off = i - pick;
        const r = Math.floor(i / IN_ROW);
        const inX = ((i % IN_ROW) - (cols - 1) / 2) * step;
        return (
          <Filed
            key={t.id}
            track={t}
            from={[inX, fromY - H * 0.12 + r * 0.06, D / 2 - 0.02 + OPEN - D * 0.2 - r * 0.5]}
            fromScale={inSize / (disk / DISK)}
            at={[off * gap, vh * 0.04, SPREAD_Z - Math.abs(off) * 0.2]}
            size={disk / DISK}
            delay={PEEK + i * 0.06}
            onOpen={() => (off === 0 ? onOpenTrack(t) : onPick(i))} // 가운데를 누르면 곡 카드, 옆을 누르면 그 디스크가 가운데로
          />
        );
      })}
    </group>
  );
}

/* 서류함 몸통 — 재료(절차적 텍스처)는 캔버스 안에서만 만든다. 바깥에서 부르면 서버 렌더에서 터진다 */
/* 서랍 수(n)만큼의 높이 — 플레이리스트가 없는 빈 서랍은 두지 않는다(10/2 사용자) */
function Carcass({ n }: { n: number }) {
  const pitch = H + GAP;
  return (
    <mesh position={[0, 0, -0.1]} material={materials().dark}>
      <boxGeometry args={[W + 2 * T, n * pitch + 2 * T, D]} />
    </mesh>
  );
}

function Drawer({
  y,
  tag,
  open,
  spread,
  fresh,
  enter = 0,
  onToggle,
}: {
  y: number;
  tag: string;
  open: boolean;
  spread?: boolean; // 안의 디스크를 다 꺼내 펼쳤다 — 서랍은 다시 살짝 들어가 디스크를 가리지 않는다
  fresh?: boolean; // 방금 저장한 서랍 — 살짝 앞으로 나와 눈에 띈다
  enter?: number; // 칸을 넘겨 새로 들어온 서랍 — 이만큼 위(+)·아래(-)에서 밀려 들어온다
  onToggle: () => void;
}) {
  const g = useRef<Group>(null!);
  const m = materials();
  const reduce = useReducedMotion();
  useFrame(({ invalidate }, dt) => {
    const to = spread ? 0.15 : open ? OPEN : fresh ? 0.18 : 0; // 펼친 뒤엔 거의 닫은 자리로 — 펼친 디스크(평면)를 가리지 않는다
    const z = D / 2 - 0.02 + to;
    const p = g.current.position;
    const k = damp(6, dt, reduce);
    if (Math.abs(p.z - z) > 0.001 || Math.abs(p.y - y) > 0.001) {
      p.z += (z - p.z) * k;
      p.y += (y - p.y) * damp(9, dt, reduce);
      invalidate();
    } else p.set(p.x, y, z);
  });

  return (
    <group ref={g} position={[0, y + (reduce ? 0 : enter), D / 2 - 0.02]} onClick={onToggle}>
      {/* 전면 + 네임택(감정 테마 태그) + 손잡이 */}
      <RoundedBox args={[W - 0.04, H, 0.05]} radius={0.012} smoothness={3} material={m.steel} />
      <RoundedBox args={[0.5, 0.14, 0.012]} radius={0.004} position={[0, H * 0.27, 0.03]} material={m.metal} />
      <mesh position={[0, H * 0.27, 0.037]} material={labelMaterial(tag)}>
        <planeGeometry args={[0.44, 0.1]} />
      </mesh>
      <RoundedBox args={[0.46, 0.05, 0.06]} radius={0.02} smoothness={4} position={[0, -H * 0.24, 0.05]} material={m.metal} />

      {/* 몸통 — 열렸을 때 안이 보인다 */}
      <mesh position={[0, -H * 0.4, -D / 2]} material={m.steel}>
        <boxGeometry args={[W - 0.16, 0.02, D]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.08), -0.05, -D / 2]} material={m.steel}>
          <boxGeometry args={[0.02, H * 0.7, D]} />
        </mesh>
      ))}

    </group>
  );
}

export default function ArchiveRoom({ fresh }: { fresh: string | null }) {
  const [open, setOpen] = useState<number | null>(null);
  // const router = useRouter(); // 보고서 꺼 둠
  const raw = useSyncExternalStore(subscribeShelves, shelvesRaw, () => "");
  const shelves = useMemo(() => parseShelves(raw), [raw]);
  // 서류함은 3단이라 서랍 3개씩 넘겨 본다 — 4번째로 저장한 서랍부터는 다음 칸에
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(0);
  const [pick, setPick] = useState(0); // 연 서랍에서 가운데에 선 디스크
  const [peeked, setPeeked] = useState(false); // 서랍을 열고 PEEK 초가 지나 디스크를 다 꺼냈다 — 서랍은 다시 들어가 가린다
  const [sheet, setSheet] = useState<Track | null>(null); // 디스크를 눌렀다 — 곡 카드(표지·설명·미리듣기)
  const [sharing, setSharing] = useState(false); // 공유 카드 화면
  const pages = Math.max(1, Math.ceil(shelves.length / PER_PAGE));
  const shown = shelves.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const openShelf = open === null ? null : shown[open];
  const turn = (d: number) => {
    const next = Math.max(0, Math.min(pages - 1, page + d));
    if (next === page) return;
    thud(90);
    openDrawer(null);
    setDir(d);
    setPage(next);
  };
  useEffect(() => void syncShelves(), []); // 로그인했으면 서버 원본으로 사본을 새로 고친다
  // 서랍을 열면 PEEK 초 뒤 펼친 것으로 — Drawer 가 물러나 펼친 디스크를 가리지 않는다(10/3 사용자: 서랍 안 대신 평면으로)
  const peekTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openDrawer = (i: number | null) => {
    clearTimeout(peekTimer.current);
    setPeeked(false);
    setOpen(i);
    if (i !== null) peekTimer.current = setTimeout(() => setPeeked(true), PEEK * 1000);
  };
  useEffect(() => () => clearTimeout(peekTimer.current), []);
  const kept = openShelf?.kept ?? [];
  const browse = (d: number) => {
    const next = Math.max(0, Math.min(kept.length - 1, pick + d));
    if (next === pick) return;
    thud(70);
    setPick(next);
  };
  const browseRef = useRef(browse);
  useEffect(() => {
    browseRef.current = browse;
  });
  // 연 서랍 — ←→ 키로 디스크를 넘긴다
  useEffect(() => {
    if (open === null || sheet || sharing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") browseRef.current(-1);
      if (e.key === "ArrowRight") browseRef.current(1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, sheet, sharing]);
  // 열린 서랍은 ESC 로 닫는다(곡 카드·공유 카드가 떠 있으면 그쪽이 먼저 닫힌다) — 10/3 사용자: 서랍을 열면 돌아갈 방법이 없었다
  useEffect(() => {
    if (open === null || sheet || sharing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openDrawer(null);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, sheet, sharing]);
  // 마우스 휠로 칸 넘기기 — 10/3 사용자: 화살표만 있어 불편했다. 한 번 굴릴 때 한 칸(0.4초에 한 번까지).
  // 곡 카드·공유 카드가 떠 있으면 넘기지 않는다(그 안의 글을 굴린다)
  const turnRef = useRef(turn);
  useEffect(() => {
    turnRef.current = turn;
  });
  useEffect(() => {
    if (sheet || sharing || (open === null && pages < 2)) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 4 || now - last < (open === null ? 400 : 250)) return;
      last = now;
      if (open !== null) browseRef.current(d > 0 ? 1 : -1); // 서랍을 열었으면 디스크를 넘긴다(결과 화면과 같다)
      else turnRef.current(d > 0 ? 1 : -1); // 닫혔으면 칸 — 아래로 굴리면 지난 서랍, 위로 굴리면 최근 서랍(▲▼ 와 같은 방향)
    };
    addEventListener("wheel", onWheel, { passive: true });
    return () => removeEventListener("wheel", onWheel);
  }, [sheet, sharing, open, pages]);
  const pitch = H + GAP;
  const drawerY = (i: number) => ((shown.length - 1) / 2 - i) * pitch; // 보이는 서랍들의 가운데가 화면 가운데

  return (
    <main data-theme="void" className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-background text-foreground">
      <div className="fixed inset-0">
        <Canvas
          frameloop="demand"
          camera={{ position: FRONT.toArray(), fov: 55 }}
          dpr={[1, 1.5]}
          onCreated={keepContext}
          onPointerMissed={() => !sheet && !sharing && open !== null && openDrawer(null)} // 빈 곳을 누르면 서랍을 닫는다
        >
          <color attach="background" args={["#000000"]} />
          <fog attach="fog" args={["#000000", 7, 14]} />
          <ambientLight intensity={0.12} />
          {/* 정면 조명은 열린 서랍(z≈2.1) 바로 위에 놓여 안을 하얗게 날린다 — 열면 줄인다(10/2) */}
          <FrontLight dim={open !== null} />
          <pointLight position={[0, 2.2, 1.6]} intensity={1.2} distance={7} decay={2} color="#cfe6f5" />
          <Wall />

          {shown.length > 0 && <Carcass n={shown.length} />}
          {shown.map((s, i) => (
            <Drawer
              key={s.id}
              y={drawerY(i)}
              tag={s.tag}
              open={open === i}
              spread={open === i && peeked}
              fresh={s.id === fresh}
              enter={dir ? -dir * ENTER * (1 + i * 0.35) : 0} // 최근 쪽(위 화살표)으로 넘기면 위에서, 지난 쪽이면 아래에서
              onToggle={() => {
                thud(open === i ? 60 : 120);
                openDrawer(open === i ? null : i);
                setPick(0);
              }}
            />
          ))}
          {openShelf && openShelf.kept.length > 0 && (
            <Spread
              key={openShelf.id}
              kept={openShelf.kept}
              pick={pick}
              onPick={(i) => {
                thud(70);
                setPick(i);
              }}
              fromY={drawerY(open!)}
              // 디스크를 누르면 곡 카드(10/2). 예전엔 보고서(app/report/[id], 꺼 둠)로 갔다
              onOpenTrack={(t) => {
                thud(140);
                setSheet(t);
              }}
            />
          )}
        </Canvas>
        {/* 위아래는 어둠에 잠긴다 */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(#000_3%,rgba(0,0,0,.7)_16%,transparent_36%,transparent_64%,rgba(0,0,0,.75)_84%,#000_97%)]" />
      </div>

      <header className="pointer-events-none relative flex items-start justify-between gap-4 px-6 pt-6 font-mono text-xs tracking-[.15em] text-foreground/65">
        <h1 className="font-[inherit] font-normal">
          MY CABINET
          <span className="block normal-case tracking-normal text-foreground/65">건져 올린 것들</span>
        </h1>
        <span className="flex items-center gap-4">
          {open !== null && (
            <button type="button" onClick={() => setOpen(null)} className="btn pointer-events-auto">
              <ArrowLeft aria-hidden size={14} weight="bold" />
              {ARCHIVE_DIALOGUE.CLOSE}
            </button>
          )}
          <Link href="/search" className="pointer-events-auto text-accent/85 hover:text-accent">
            NEW REQUEST
          </Link>
        </span>
      </header>

      <div className="flex-1" />

      {/* 아직 넣은 서랍이 없다 — 빈 서류함 대신 한마디와 편지 쓰러 가기 */}
      {shelves.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-letter text-sm text-foreground/75">{ARCHIVE_DIALOGUE.EMPTY}</p>
          <Link href="/search" className="btn">
            {ARCHIVE_DIALOGUE.WRITE}
            <ArrowRight aria-hidden size={14} weight="bold" />
          </Link>
        </div>
      )}

      {pages > 1 && (
        /* 다른 서랍 칸으로 — 위가 최근에 넣은 것 */
        <nav aria-label="서랍 칸" className="absolute top-1/2 right-6 flex -translate-y-1/2 flex-col items-center gap-2 font-mono text-xs tracking-[.15em] text-accent/85">
          <button type="button" aria-label="최근 서랍" disabled={page === 0} onClick={() => turn(-1)} className="grid size-10 place-items-center rounded-full hover:text-accent disabled:opacity-30">
            <CaretUp aria-hidden size={18} weight="bold" />
          </button>
          <span className="text-foreground/65">
            {page + 1}/{pages}
          </span>
          <button type="button" aria-label="지난 서랍" disabled={page === pages - 1} onClick={() => turn(1)} className="grid size-10 place-items-center rounded-full hover:text-accent disabled:opacity-30">
            <CaretDown aria-hidden size={18} weight="bold" />
          </button>
        </nav>
      )}

      {openShelf && kept.length > 1 && (
        /* 디스크 넘기기 — 휠·←→ 키도 같다 */
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-6 text-accent/85">
          <button type="button" aria-label="이전 곡" disabled={pick === 0} onClick={() => browse(-1)} className="pointer-events-auto grid size-10 place-items-center rounded-ui hover:text-accent disabled:opacity-30">
            <CaretLeft aria-hidden size={20} weight="bold" />
          </button>
          <button type="button" aria-label="다음 곡" disabled={pick === kept.length - 1} onClick={() => browse(1)} className="pointer-events-auto grid size-10 place-items-center rounded-ui hover:text-accent disabled:opacity-30">
            <CaretRight aria-hidden size={20} weight="bold" />
          </button>
        </div>
      )}
      {openShelf && openShelf.kept.length > 0 && <ListenPanel key={openShelf.id} shelf={openShelf} onShare={() => setSharing(true)} />}

      {openShelf && sheet && <TrackSheet track={sheet} query={openShelf.query} shelfId={openShelf.id} onClose={() => setSheet(null)} />}
      {openShelf && sharing && (
        <CardReveal
          key={openShelf.id}
          data={{ q: openShelf.query || openShelf.tag, keywords: openShelf.keywords?.length ? openShelf.keywords : [openShelf.tag.replace(/^#/, "")], tracks: openShelf.kept }}
          shelfId={openShelf.id}
          remote={!!openShelf.remote}
          onDone={() => setSharing(false)}
          doneLabel={PLAYLIST_DIALOGUE.CLOSE}
        />
      )}

      <footer className="relative px-6 pb-8 text-center font-mono text-xs tracking-[.15em] text-foreground/60">
        {openShelf ? `${openShelf.tag} · ${pick + 1}/${openShelf.kept.length}${kept[pick] ? ` · ${kept[pick].title}` : ""}` : shown.length ? "CLICK A DRAWER TO OPEN" : null}
      </footer>
    </main>
  );
}

