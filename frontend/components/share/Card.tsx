/* 인스타 스토리 공유 카드(1080×1920) — 서류함이 떼어 주는 영수증. 편지가 주문서, 곡 10개가 품목, 일치도가 금액, 관리인 한마디가 메모.
   10/2 사용자: 영수증 공유 카드처럼(Receiptify 류). 이름·로고는 따라 하지 않고 CABINET 영수증으로.
   next/og(Satori)로 PNG 를 그린다 — flex 와 일부 CSS 만 되고, 글꼴은 직접 넣어 준다(render.ts — 고정폭 Plex Mono, 한글은 조선굴림으로 받침) */

export type ShareData = {
  q: string; // 편지 문장
  keywords: string[]; // 요청 해석
  line?: string | null; // 관리인 한마디
  tracks: { title: string; artist: string; artwork?: string | null; semantic?: number }[];
  link?: string | null; // QR 로 넣을 주소 — 공개 서랍(/s/:id) 또는 유튜브 이어 듣기(watch_videos)
};

const BG = "#07090d";
const ACCENT = "#00e5ff";
const INK = "#26262a"; // 감열지 잉크 — 새까맣지 않게
const PAPER = "#f7f6f2";
const FONT = "Mono, Chosun";
const W = 780; // 영수증 폭
const RULE = { borderTop: `2px dashed ${INK}`, opacity: 0.55, margin: "18px 0" } as const;

/* 막대 굵기를 글자에서 뽑은 장식 바코드 — 같은 편지면 같은 무늬 */
function barsOf(seed: string) {
  let h = 7;
  return Array.from({ length: 64 }, () => (h = (h * 31 + seed.charCodeAt(h % Math.max(1, seed.length)) + 17) % 9973) % 4);
}

function Barcode({ seed }: { seed: string }) {
  const bars = barsOf(seed);
  return (
    <div style={{ display: "flex", height: 96, justifyContent: "center" }}>
      {bars.map((b, i) => (
        <div key={i} style={{ width: b + 2, height: 96, marginRight: (i * 7) % 3 === 0 ? 4 : 2, background: INK }} />
      ))}
    </div>
  );
}

const upper = (s: string) => s.toUpperCase(); // 영문만 대문자로 — 한글은 그대로

/** qr = QR 그림(data URL), shelf = QR 이 공개 서랍 주소인가(아니면 유튜브), date·no = 영수증 날짜·번호(서버가 붙인다) */
export default function Card({ q, keywords, line, tracks, qr, shelf, date, no }: Omit<ShareData, "link"> & { qr?: string | null; shelf?: boolean; date: string; no: string }) {
  const ten = tracks.slice(0, 10);
  const known = ten.filter((t) => t.semantic);
  const avg = known.length ? Math.round(known.reduce((s, t) => s + (t.semantic ?? 0), 0) / known.length) : null;
  const row = { display: "flex", justifyContent: "space-between" } as const;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 1080, height: 1920, background: "#dcdcd8" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          padding: "64px 54px 56px",
          background: PAPER,
          // 구겨진 감열지 — 비스듬한 빛 몇 줄로 주름만 살짝
          backgroundImage:
            "linear-gradient(115deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.025) 31%, rgba(0,0,0,0) 38%), linear-gradient(70deg, rgba(0,0,0,0) 58%, rgba(0,0,0,.025) 59%, rgba(0,0,0,0) 65%), linear-gradient(160deg, rgba(255,255,255,.5) 10%, rgba(0,0,0,.015) 50%, rgba(255,255,255,.3) 90%)",
          boxShadow: "0 30px 60px rgba(0,0,0,.18)",
          color: INK,
          fontFamily: FONT,
          fontSize: 27,
          lineHeight: 1.4,
          wordBreak: "keep-all",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", fontSize: 76, fontWeight: 600, letterSpacing: 4 }}>CABINET</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6, fontSize: 26, letterSpacing: 3 }}>서류함 영수증</div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 42 }}>
          <span>ORDER #{no}</span>
          <span style={{ marginTop: 4 }}>“{q.slice(0, 70)}”</span>
          <span style={{ marginTop: 4 }}>{date}</span>
        </div>

        <div style={RULE} />
        <div style={{ ...row, fontSize: 24 }}>
          <span style={{ width: 70 }}>QTY</span>
          <span style={{ flex: 1 }}>ITEM</span>
          <span>MATCH</span>
        </div>
        <div style={RULE} />

        {ten.map((t, i) => (
          <div key={i} style={{ ...row, marginBottom: 12 }}>
            <span style={{ width: 70, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ flex: 1, paddingRight: 24 }}>
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
        <div style={RULE} />

        {keywords.length > 0 && <span>MOOD: {keywords.slice(0, 4).join(" · ")}</span>}
        <span style={{ marginTop: 4 }}>CASHIER: 서류함 관리인</span>
        {line && <span style={{ marginTop: 14 }}>MEMO: {line.slice(0, 70)}</span>}

        <div style={{ display: "flex", justifyContent: "center", marginTop: 34, fontSize: 28 }}>또 오게. THANK YOU FOR VISITING!</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 26 }}>
          <Barcode seed={q + no} />
        </div>

        {/* QR — 휴대폰 카메라로 비추면 공개 서랍(또는 유튜브)이 열린다(흰 바탕 검은 점 — 인식이 잘 되게) */}
        {qr && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 26 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori 는 img 만 그린다 */}
            <img src={qr} width={150} height={150} alt="" />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 24, fontSize: 24 }}>
              <span>카메라로 비추면</span>
              <span>{shelf ? "이 서랍 열어 보기" : "유튜브에서 이어 듣기"}</span>
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20, fontSize: 22, letterSpacing: 1 }}>cabinet-flame-zeta.vercel.app</div>
      </div>
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
