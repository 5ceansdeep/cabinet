/* 인스타 스토리 공유 카드(1080×1920) — 서류함 마트가 떼어 주는 영수증. 편지가 주문서, 곡 10개가 품목, 일치도가 금액.
   10/2 사용자: 영수증 공유 카드처럼(Receiptify·감열지 사진 레퍼런스). 이름·로고는 따라 하지 않고 미국 마트풍 CABINET 로고로.
   뒤에는 앨범 표지가 좌우로 다섯 장씩, 영수증 위엔 감열지로 찍은 듯한 플로피 그림(thermal.ts).
   next/og(Satori)로 PNG 를 그린다 — flex 와 일부 CSS 만 되고, 글꼴은 직접 넣어 준다(render.ts — 로고 Anton, 본문 고정폭 Plex Mono, 한글은 조선굴림) */

import { THERMAL_FLOPPY } from "./thermal";

export type ShareData = {
  q: string; // 편지 문장
  keywords: string[]; // 요청 해석
  line?: string | null; // 관리인 한마디 — 영수증엔 안 찍는다(10/2), 보내는 쪽 호환으로 남김
  tracks: { title: string; artist: string; artwork?: string | null; semantic?: number }[];
  link?: string | null; // QR 로 넣을 주소 — 공개 서랍(/s/:id) 또는 유튜브 이어 듣기(watch_videos)
};

export const INK = "#26262a"; // 감열지 잉크 — 새까맣지 않게 (공유 페이지도 같이 쓴다)
export const PAPER = "#f7f6f2";
const FONT = "Mono, Chosun";
const W = 760; // 영수증 폭
const RULE = { borderTop: `2px dashed ${INK}`, opacity: 0.55, margin: "18px 0" } as const;
const COVER = 372; // 뒤에 깔리는 표지 한 장 — 세로 다섯 장이 1920 을 거의 채운다(겹쳐 쌓인다)
const SWATCH = ["#1e3a5f", "#5b3a5f", "#2f5f4a", "#6a4a2a", "#3a3f5f"]; // 표지 없는 곡 자리

/* 구겨진 감열지 — public/paper-crumple.png(scripts/crumple.mjs 가 만든 그늘·빛 반투명 층)을 종이색 위에 늘려 덮는다.
   10/2 사용자: 빛줄기 몇 줄로 흉내 낸 구김이 "그래픽" 같았다 — 조각면마다 빛을 다르게 받는 진짜 구김 그림으로 */
export const PAPER_IMAGE = "/paper-crumple.png";

/* 막대 굵기를 글자에서 뽑은 장식 바코드 — 같은 편지면 같은 무늬 */
export function barsOf(seed: string) {
  let h = 7;
  return Array.from({ length: 64 }, () => (h = (h * 31 + seed.charCodeAt(h % Math.max(1, seed.length)) + 17) % 9973) % 4);
}

/* 카드에선 막대를 SVG 한 장으로 — 막대마다 div 64개로 그리면 그것만 0.85초 걸렸다(10/2 카드 인쇄 9초) */
function barcodeSvg(seed: string) {
  let x = 0;
  const rects = barsOf(seed)
    .map((b, i) => {
      const r = `<rect x="${x}" width="${b + 2}" height="90" fill="${INK}"/>`;
      x += b + 2 + ((i * 7) % 3 === 0 ? 4 : 2);
      return r;
    })
    .join("");
  return { width: x, src: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="90">${rects}</svg>`)}` };
}

function Barcode({ seed }: { seed: string }) {
  const { width, src } = barcodeSvg(seed);
  // eslint-disable-next-line @next/next/no-img-element -- Satori 는 img 만 그린다
  return <img src={src} width={width} height={90} alt="" />;
}

/* 미국 마트 간판풍 로고 — 굵은 압축 고딕 CABINET 을 두꺼운 테두리 간판에, 아래 반전 띠 "SONG & FILE MARKET", 위에 별 셋.
   display = 로고 글꼴 이름 — 카드(Satori)는 "Anton", 공유 페이지는 next/font 변수. scale = 크기 배율 */
export function Logo({ display = "Anton", scale = 1 }: { display?: string; scale?: number }) {
  const k = (n: number) => n * scale;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", fontSize: k(26), letterSpacing: k(18), marginBottom: k(6) }}>★★★</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", border: `${k(6)}px solid ${INK}`, borderRadius: k(20), overflow: "hidden" }}>
        <div style={{ display: "flex", fontFamily: display, fontSize: k(100), lineHeight: 1, letterSpacing: k(6), padding: `${k(12)}px ${k(30)}px ${k(4)}px` }}>CABINET</div>
        <div style={{ display: "flex", justifyContent: "center", width: "100%", background: INK, color: PAPER, fontSize: k(24), fontWeight: 600, letterSpacing: k(7), padding: `${k(8)}px 0 ${k(10)}px` }}>
          SONG &amp; FILE MARKET
        </div>
      </div>
      <div style={{ display: "flex", marginTop: k(12), fontSize: k(22), letterSpacing: k(3) }}>STORE #001 · SEOUL · OPEN 24 HRS</div>
    </div>
  );
}

/* 뒤에 깔리는 앨범 표지 — 왼쪽 다섯 장(1~5번 곡), 오른쪽 다섯 장(6~10번 곡). 살짝씩 기울여 흩뿌린 듯, 안쪽은 영수증에 가린다.
   곡이 10곡보다 적으면 앞 곡 표지를 되풀이한다. Satori 는 absolute 위치를 엇나가게 계산해(위쪽 표지가 아래로 밀렸다) 세로 줄로 쌓는다 */
function Covers({ tracks, side }: { tracks: ShareData["tracks"]; side: "left" | "right" }) {
  const left = side === "left";
  const five = Array.from({ length: 5 }, (_, r) => tracks[(r + (left ? 0 : 5)) % Math.max(1, tracks.length)]);
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: (1080 - W) / 2, height: 1920, padding: "6px 0" }}>
      {five.map((t, r) => {
        const style = {
          width: COVER,
          height: COVER,
          flexShrink: 0,
          marginLeft: left ? (1080 - W) / 2 - COVER + 40 : 14, // 오른쪽 줄은 영수증보다 뒤에 그려져 덮으므로 겹치지 않게 띄운다
          transform: `rotate(${[-4, 3, -2, 5, -3][r] * (left ? 1 : -1)}deg)`,
        } as const;
        return t?.artwork ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori 는 img 만 그린다
          <img key={r} src={t.artwork} width={COVER} height={COVER} style={{ ...style, objectFit: "cover" }} alt="" />
        ) : (
          <div key={r} style={{ ...style, background: `linear-gradient(135deg, ${SWATCH[r]}, #8ec5fc)` }} />
        );
      })}
    </div>
  );
}

const upper = (s: string) => s.toUpperCase(); // 영문만 대문자로 — 한글은 그대로
/** 한 줄에 들어갈 만큼 — 한글은 영문 두 칸으로 센다. 넘치면 … */
const clip = (s: string, cols: number) => {
  let w = 0;
  for (let i = 0; i < s.length; i++) if ((w += /[가-힣ㄱ-ㅎ]/.test(s[i]) ? 2 : 1) > cols) return s.slice(0, i) + "…";
  return s;
};

/** qr = QR 그림(data URL), shelf = QR 이 공개 서랍 주소인가(아니면 유튜브), date·no = 영수증 날짜·번호(서버가 붙인다) */
/** paper = 구김 그림(data URL — Satori 는 주소로 못 읽어 서버가 파일을 읽어 넘긴다) */
export default function Card({ q, keywords, tracks, qr, shelf, date, no, paper }: Omit<ShareData, "link"> & { qr?: string | null; shelf?: boolean; date: string; no: string; paper?: string }) {
  const ten = tracks.slice(0, 10);
  const known = ten.filter((t) => t.semantic);
  const avg = known.length ? Math.round(known.reduce((s, t) => s + (t.semantic ?? 0), 0) / known.length) : null;
  const row = { display: "flex", justifyContent: "space-between" } as const;
  return (
    <div style={{ display: "flex", alignItems: "center", width: 1080, height: 1920, background: "#1b1b1f", overflow: "hidden" }}>
      <Covers tracks={ten} side="left" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          padding: "44px 48px 40px",
          backgroundColor: PAPER,
          ...(paper && { backgroundImage: `url(${paper})`, backgroundSize: "100% 100%" }),
          boxShadow: "0 10px 18px rgba(0,0,0,.45)", // 넓게 퍼지는 흐림은 그리는 데 오래 걸린다(70px 흐림 + 표지 10장 그림자 = 1.5초)
          color: INK,
          fontFamily: FONT,
          fontSize: 24,
          lineHeight: 1.36,
          flexShrink: 0,
          wordBreak: "keep-all",
        }}
      >
        <Logo />

        {/* 감열지에 찍힌 플로피 두 장 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori 는 img 만 그린다 */}
        <img src={THERMAL_FLOPPY} width={420} height={244} style={{ alignSelf: "center", marginTop: 14, opacity: 0.85 }} alt="" />

        <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
          <div style={row}>
            <span>ORDER #{no}</span>
            <span>REG. # 02</span>
          </div>
          <span style={{ marginTop: 4 }}>“{q.slice(0, 70)}”</span>
          <span style={{ marginTop: 4 }}>{date}</span>
        </div>

        <div style={RULE} />
        <div style={{ ...row, fontSize: 23 }}>
          <span style={{ width: 66 }}>QTY</span>
          <span style={{ flex: 1 }}>ITEM</span>
          <span>MATCH</span>
        </div>
        <div style={RULE} />

        {ten.map((t, i) => (
          <div key={i} style={{ ...row, marginBottom: 10 }}>
            <span style={{ width: 66, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ flex: 1, paddingRight: 22 }}>
              {upper(t.title.slice(0, 40))} - {upper(t.artist.slice(0, 26))}
            </span>
            <span style={{ flexShrink: 0 }}>{t.semantic ? `${t.semantic}%` : "--"}</span>
          </div>
        ))}

        <div style={RULE} />
        <div style={row}>
          <span>ITEM COUNT:</span>
          <span>{ten.length}</span>
        </div>
        <div style={{ ...row, marginTop: 4 }}>
          <span>AVG MATCH:</span>
          <span>{avg === null ? "--" : `${avg}%`}</span>
        </div>
        {keywords.length > 0 && <span style={{ marginTop: 4 }}>MOOD: {keywords.slice(0, 4).join(" · ")}</span>}
        <div style={RULE} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 6 }}>
          <Barcode seed={q + no} />
          {/* QR — 휴대폰 카메라로 비추면 공개 서랍(또는 유튜브)이 열린다(흰 바탕 검은 점 — 인식이 잘 되게) */}
          {qr && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: 26 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Satori 는 img 만 그린다 */}
              <img src={qr} width={128} height={128} alt="" />
              <span style={{ fontSize: 20, marginTop: 4 }}>{shelf ? "서랍 열어 보기" : "유튜브에서 이어 듣기"}</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 26, fontSize: 22, letterSpacing: 2 }}>
          <span>ALL SALES FINAL</span>
          <span style={{ marginTop: 4 }}>THANK YOU FOR SHOPPING AT CABINET</span>
        </div>
      </div>
      <Covers tracks={ten} side="right" />
    </div>
  );
}

/* 링크 미리보기(1200×630) — 카톡·DM 에 공개 서랍 링크를 붙이면 뜬다. 같은 영수증의 윗부분(로고·편지·곡 네 줄) + 좌우에 앨범 표지 두 장씩.
   카톡은 그림 가운데를 잘라 보여 주기도 해서 중요한 건 가운데에 모은다. 10/2 사용자: 카드처럼 영수증 느낌으로 */
export function OgCard({ q, tag, tracks, paper }: { q: string; tag: string; tracks: ShareData["tracks"]; paper?: string }) {
  const side = (from: number, dir: 1 | -1) => (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 330, height: 630 }}>
      {[0, 1].map((r) => {
        const t = tracks[(from + r) % Math.max(1, tracks.length)];
        const style = { width: 290, height: 290, flexShrink: 0, margin: "8px 20px", transform: `rotate(${(r ? -3 : 4) * dir}deg)`, } as const;
        return t?.artwork ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori 는 img 만 그린다
          <img key={r} src={t.artwork} width={290} height={290} style={{ ...style, objectFit: "cover" }} alt="" />
        ) : (
          <div key={r} style={{ ...style, background: `linear-gradient(135deg, ${SWATCH[r + from]}, #8ec5fc)` }} />
        );
      })}
    </div>
  );
  const four = tracks.slice(0, 4);
  return (
    <div style={{ display: "flex", width: 1200, height: 630, background: "#1b1b1f", overflow: "hidden" }}>
      {side(0, 1)}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 540,
          height: 660,
          marginTop: 20,
          padding: "26px 40px 0",
          backgroundColor: PAPER,
          ...(paper && { backgroundImage: `url(${paper})`, backgroundSize: "100% 100%" }),
          boxShadow: "0 8px 16px rgba(0,0,0,.45)",
          color: INK,
          fontFamily: FONT,
          fontSize: 21,
          lineHeight: 1.36,
          wordBreak: "keep-all",
        }}
      >
        <Logo scale={0.62} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <span>“{q.slice(0, 22)}”</span>
          <span>{tag}</span>
        </div>
        <div style={{ ...RULE, margin: "12px 0" }} />
        {four.map((t, i) => (
          <div key={i} style={{ display: "flex", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ width: 46, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
            <span>{clip(upper(`${t.title} - ${t.artist}`), 30)}</span>
          </div>
        ))}
        {tracks.length > 4 && <div style={{ display: "flex", marginTop: 4, opacity: 0.7 }}>+ {tracks.length - 4} MORE ITEMS</div>}
      </div>
      {side(2, -1)}
    </div>
  );
}
