"use client";

import Link from "next/link";
import { ArrowRight, CaretDown, CaretUp } from "@phosphor-icons/react";
// import { useRouter } from "next/navigation"; // 보고서 꺼 둠 — 디스크를 눌러 보고서로 갈 때 쓴다
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Vector3, type Group } from "three";
import { CABINET } from "@/components/landing/dimensions";
import { labelMaterial, materials } from "@/components/landing/materials";
import { Wall } from "@/components/results/CabinetWall";
import { DISK, FloppyBody, useLabel } from "@/components/results/floppy";
import type { Track } from "@/components/results/tracks";
import { thud } from "@/lib/thud";
import { ARCHIVE_DIALOGUE, PLAYLIST_DIALOGUE } from "@/components/landing/lines";
import CardReveal from "@/components/share/CardReveal";
import ListenPanel from "./ListenPanel";
import TrackSheet from "./TrackSheet";
import { parseShelves, shelvesRaw, subscribeShelves, syncShelves } from "./shelf";

/* 5번 아카이빙 메인 룸 — 나만의 서류함. 서랍 전면에 감정 테마 태그가 네임택으로 붙어 있고,
   서랍을 누르면 앞으로 열리며 카메라가 위로 올라가 안을 내려다본다(Top-down).
   모은 플로피가 종이 파일 사이에 가지런히 꽂혀 있다. 방(둘러선 벽)은 4번과 같은 것을 쓴다 */

const { W, H, D, T, GAP } = CABINET;
const OPEN = 1.5; // 서랍이 빠지는 거리
const PER_PAGE = 3; // 서류함 한 짝에 서랍 3개
const ROW = 5; // 서랍 안 한 줄에 꽂는 플로피 수 — 서랍 폭(W)에 맞춘다
const FRONT = new Vector3(0, 0, 3.2); // 서류함을 정면에서
const LOOK_FRONT = new Vector3(0, 0, 0);
const TOP = new Vector3(0, 2.3, 2.1); // 열린 서랍을 내려다보는 자리
const v = new Vector3();

/* 카메라 — 서랍을 열면 위로 올라가 안을 내려다본다 */
function Rig({ open, drawerY }: { open: boolean; drawerY: number }) {
  const look = useRef(LOOK_FRONT.clone());
  useFrame(({ camera, invalidate }, dt) => {
    const k = 1 - Math.exp(-3 * dt);
    const to = open ? v.set(0, TOP.y, TOP.z) : v.copy(FRONT);
    const at = open ? new Vector3(0, drawerY, D / 2 + OPEN - 0.4) : LOOK_FRONT;
    if (camera.position.distanceTo(to) > 0.002 || look.current.distanceTo(at) > 0.002) {
      camera.position.lerp(to, k);
      look.current.lerp(at, k);
      camera.lookAt(look.current);
      invalidate();
    }
  });
  return null;
}

/* 서랍 속에 꽂힌 플로피 한 장 — 종이 파일에 기대어 비스듬히 선다 */
function Filed({ track, x, size, onOpen }: { track: Track; x: number; size: number; onOpen: () => void }) {
  const { invalidate } = useThree();
  const label = useLabel(track, invalidate); // 커버가 도착하면 다시 그린다
  const [hover, setHover] = useState(false);
  return (
    <group
      position={[x, hover ? 0.12 : 0, 0]}
      rotation={[-0.35, 0, 0]}
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
  kept,
  open,
  fresh,
  onToggle,
  onOpenTrack,
}: {
  y: number;
  tag: string;
  kept: Track[];
  open: boolean;
  fresh?: boolean; // 방금 저장한 서랍 — 살짝 앞으로 나와 눈에 띈다
  onToggle: () => void;
  onOpenTrack: (t: Track) => void;
}) {
  const g = useRef<Group>(null!);
  const m = materials();
  useFrame(({ invalidate }, dt) => {
    const to = open ? OPEN : fresh ? 0.18 : 0;
    const z = D / 2 - 0.02 + to;
    if (Math.abs(g.current.position.z - z) > 0.001) {
      g.current.position.z += (z - g.current.position.z) * (1 - Math.exp(-6 * dt));
      invalidate();
    }
  });

  return (
    <group ref={g} position={[0, y, D / 2 - 0.02]} onClick={onToggle}>
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

      {/* 종이 파일 사이에 꽂힌 플로피들 — 한 줄에 ROW 장, 넘치면 뒤 줄로(10/2: 10곡이 한 줄이면 서랍 밖으로 삐져나왔다) */}
      {open && (
        <group position={[0, -H * 0.12, -D * 0.2]}>
          {kept.map((t, i) => {
            const cols = Math.min(ROW, kept.length);
            const row = Math.floor(i / ROW);
            const step = Math.min(0.34, (W - 0.3) / cols);
            const x = ((i % ROW) - (cols - 1) / 2) * step;
            return (
              <group key={t.id} position={[0, row * 0.06, -row * 0.5]}>
                {/* 앞뒤로 받쳐 주는 종이 파일 */}
                <mesh position={[x - step / 2, -0.02, -0.02]} rotation={[-0.35, 0, 0]} material={m.manila}>
                  <planeGeometry args={[step - 0.04, 0.42]} />
                </mesh>
                <Filed track={t} x={x} size={Math.min(0.42, (step * 0.9) / DISK)} onOpen={() => onOpenTrack(t)} />
              </group>
            );
          })}
        </group>
      )}
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
  const [sheet, setSheet] = useState<Track | null>(null); // 디스크를 눌렀다 — 곡 카드(표지·설명·미리듣기)
  const [sharing, setSharing] = useState(false); // 공유 카드 화면
  const pages = Math.max(1, Math.ceil(shelves.length / PER_PAGE));
  const shown = shelves.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const openShelf = open === null ? null : shown[open];
  const turn = (d: number) => {
    const next = Math.max(0, Math.min(pages - 1, page + d));
    if (next === page) return;
    thud(90);
    setOpen(null);
    setPage(next);
  };
  useEffect(() => void syncShelves(), []); // 로그인했으면 서버 원본으로 사본을 새로 고친다
  const pitch = H + GAP;
  const drawerY = (i: number) => ((shown.length - 1) / 2 - i) * pitch; // 보이는 서랍들의 가운데가 화면 가운데

  return (
    <main data-theme="void" className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-background text-foreground">
      <div className="fixed inset-0">
        <Canvas frameloop="demand" camera={{ position: FRONT.toArray(), fov: 55 }} dpr={[1, 1.5]}>
          <color attach="background" args={["#000000"]} />
          <fog attach="fog" args={["#000000", 7, 14]} />
          <ambientLight intensity={0.12} />
          {/* 정면 조명은 열린 서랍(z≈2.1) 바로 위에 놓여 안을 하얗게 날린다 — 열면 줄인다(10/2) */}
          <pointLight position={[0, 0.6, 2.4]} intensity={open === null ? 6 : 1.5} distance={9} decay={2} color="#ffffff" />
          <pointLight position={[0, 2.2, 1.6]} intensity={1.2} distance={7} decay={2} color="#cfe6f5" />
          <Wall />
          <Rig open={open !== null} drawerY={open === null ? 0 : drawerY(open)} />

          {shown.length > 0 && <Carcass n={shown.length} />}
          {shown.map((s, i) => (
            <Drawer
              key={s.id}
              y={drawerY(i)}
              tag={s.tag}
              kept={s.kept}
              open={open === i}
              fresh={s.id === fresh}
              onToggle={() => {
                thud(open === i ? 60 : 120);
                setOpen(open === i ? null : i);
              }}
              // 디스크를 누르면 곡 카드(10/2). 예전엔 보고서(app/report/[id], 꺼 둠)로 갔다
              onOpenTrack={(t) => {
                thud(140);
                setSheet(t);
              }}
            />
          ))}
        </Canvas>
        {/* 위아래는 어둠에 잠긴다 */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(#000_3%,rgba(0,0,0,.7)_16%,transparent_36%,transparent_64%,rgba(0,0,0,.75)_84%,#000_97%)]" />
      </div>

      <header className="pointer-events-none relative flex items-start justify-between gap-4 px-6 pt-6 font-mono text-xs tracking-[.15em] text-foreground/65">
        <h1 className="font-[inherit] font-normal">
          MY CABINET
          <span className="block normal-case tracking-normal text-foreground/65">건져 올린 것들</span>
        </h1>
        <Link href="/search" className="pointer-events-auto text-accent/85 hover:text-accent">
          NEW REQUEST
        </Link>
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
        {openShelf ? `${openShelf.tag} · ${openShelf.kept.length}장` : shown.length ? "CLICK A DRAWER TO OPEN" : null}
      </footer>
    </main>
  );
}

