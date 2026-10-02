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

const BG = "#07090d";
const ACCENT = "#00e5ff";
const INK = "#26262a"; // 감열지 잉크 — 새까맣지 않게
const PAPER = "#f7f6f2";
const FONT = "Mono, Chosun";
const W = 760; // 영수증 폭
const RULE = { borderTop: `2px dashed ${INK}`, opacity: 0.55, margin: "18px 0" } as const;
const COVER = 372; // 뒤에 깔리는 표지 한 장 — 세로 다섯 장이 1920 을 거의 채운다(겹쳐 쌓인다)
const SWATCH = ["#1e3a5f", "#5b3a5f", "#2f5f4a", "#6a4a2a", "#3a3f5f"]; // 표지 없는 곡 자리

/* 구겨진 감열지 — 접힌 자리마다 어두운 줄 하나 + 바로 옆 밝은 줄 하나(빛을 받은 면). 각도를 섞어 손으로 구긴 듯 */
const CREASES = [
  [112, 18],
  [68, 31],
  [97, 47],
  [128, 58],
  [74, 72],
  [104, 86],
  [61, 12],
  [140, 39],
].map(([deg, at]) => `linear-gradient(${deg}deg, rgba(0,0,0,0) ${at - 2}%, rgba(0,0,0,.04) ${at}%, rgba(255,255,255,.28) ${at + 0.8}%, rgba(0,0,0,0) ${at + 4}%)`);
const PAPER_BG = [...CREASES, "linear-gradient(160deg, rgba(255,255,255,.5) 10%, rgba(0,0,0,.035) 50%, rgba(255,255,255,.35) 90%)"].join(", ");

/* 막대 굵기를 글자에서 뽑은 장식 바코드 — 같은 편지면 같은 무늬 */
function barsOf(seed: string) {
  let h = 7;
  return Array.from({ length: 64 }, () => (h = (h * 31 + seed.charCodeAt(h % Math.max(1, seed.length)) + 17) % 9973) % 4);
}

function Barcode({ seed }: { seed: string }) {
  const bars = barsOf(seed);
  return (
    <div style={{ display: "flex", height: 90, justifyContent: "center" }}>
      {bars.map((b, i) => (
        <div key={i} style={{ width: b + 2, height: 90, marginRight: (i * 7) % 3 === 0 ? 4 : 2, background: INK }} />
      ))}
    </div>
  );
}

/* 미국 마트 간판풍 로고 — 굵은 압축 고딕 CABINET 을 두꺼운 테두리 간판에, 아래 반전 띠 "SONG & FILE MARKET", 위에 별 셋 */
function Logo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", fontSize: 26, letterSpacing: 18, marginBottom: 6 }}>★★★</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", border: `6px solid ${INK}`, borderRadius: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: 100, lineHeight: 1, letterSpacing: 6, padding: "12px 30px 4px" }}>CABINET</div>
        <div style={{ display: "flex", justifyContent: "center", width: "100%", background: INK, color: PAPER, fontSize: 24, fontWeight: 600, letterSpacing: 7, padding: "8px 0 10px" }}>
          SONG &amp; FILE MARKET
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 12, fontSize: 22, letterSpacing: 3 }}>STORE #001 · SEOUL · OPEN 24 HRS</div>
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
          boxShadow: "0 12px 30px rgba(0,0,0,.35)",
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

/** qr = QR 그림(data URL), shelf = QR 이 공개 서랍 주소인가(아니면 유튜브), date·no = 영수증 날짜·번호(서버가 붙인다) */
export default function Card({ q, keywords, tracks, qr, shelf, date, no }: Omit<ShareData, "link"> & { qr?: string | null; shelf?: boolean; date: string; no: string }) {
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
          background: PAPER,
          backgroundImage: PAPER_BG,
          boxShadow: "0 30px 70px rgba(0,0,0,.55)",
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
          <span>ALL SALES FINAL · 감정은 환불되지 않네</span>
          <span style={{ marginTop: 4 }}>THANK YOU FOR SHOPPING AT CABINET</span>
        </div>
      </div>
      <Covers tracks={ten} side="right" />
    </div>
  );
}

/* 플로피 한 장 — 링크 미리보기용(검은 몸체, 금속 셔터, 표지가 인쇄된 라벨 — Deck 의 3D 디스크와 같은 생김새) */
function Floppy({ title, artwork }: { title: string; artwork?: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 176, height: 176, borderRadius: 10, background: "#1c2230", padding: "10px 14px 14px" }}>
      <div style={{ width: 80, height: 46, background: "#aab1bb", borderRadius: 3 }} />
      <div style={{ display: "flex", flexDirection: "column", width: 148, marginTop: 8, background: "#ece8dc", borderRadius: 3, overflow: "hidden" }}>
        {artwork ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori 는 img 만 그린다
          <img src={artwork} width={148} height={76} style={{ objectFit: "cover" }} alt="" />
        ) : (
          <div style={{ width: 148, height: 76, background: "linear-gradient(135deg,#1e3a5f,#8ec5fc)" }} />
        )}
        <div style={{ display: "flex", padding: "4px 6px", fontSize: 13, color: "#212529", whiteSpace: "nowrap", overflow: "hidden" }}>{title.slice(0, 14)}</div>
      </div>
    </div>
  );
}

/* 링크 미리보기(1200×630) — 카톡·DM 에 공개 서랍 링크를 붙이면 뜬다. 편지 문장 + 플로피 5장 */
export function OgCard({ q, tag, tracks }: { q: string; tag: string; tracks: ShareData["tracks"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 1200, height: 630, background: BG, color: "#e2e8f0", padding: "56px 64px", fontFamily: "Chosun", wordBreak: "keep-all" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, letterSpacing: 6, color: "rgba(226,232,240,.45)" }}>
        <span>CABINET</span>
        <span style={{ color: ACCENT }}>{tag}</span>
      </div>
      <div style={{ display: "flex", marginTop: 34, fontSize: 52, lineHeight: 1.3, color: "#ffffff" }}>“{q.slice(0, 40)}”</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto" }}>
        {tracks.slice(0, 5).map((t, i) => (
          <Floppy key={i} title={t.title} artwork={t.artwork} />
        ))}
      </div>
    </div>
  );
}
