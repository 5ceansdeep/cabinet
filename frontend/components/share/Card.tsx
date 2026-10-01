/* 인스타 스토리 공유 카드(1080×1920) — 결과 화면과 같은 검은 방. 편지 문장, 요청 해석, 플로피 10장, 파란 곡 목록, 신의 한마디.
   next/og(Satori)로 PNG 를 그린다 — flex 와 일부 CSS 만 되고, 글꼴은 직접 넣어 준다(app/api/share/route.tsx) */

export type ShareData = {
  q: string; // 편지 문장
  keywords: string[]; // 요청 해석
  line?: string | null; // 신의 한마디
  tracks: { title: string; artist: string; artwork?: string | null }[];
  youtube?: string | null; // 유튜브 이어 듣기 링크(watch_videos) — 있으면 QR 로
};

const BG = "#07090d";
const ACCENT = "#00e5ff";
const YELLOW = "#ffde3b";
const OUTLINE = "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000";

/* 플로피 한 장 — 검은 몸체, 금속 셔터, 표지가 인쇄된 라벨(Deck 의 3D 디스크와 같은 생김새) */
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

export default function Card({ q, keywords, line, tracks, qr }: Omit<ShareData, "youtube"> & { qr?: string | null }) {
  const ten = tracks.slice(0, 10);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 1080, height: 1920, background: BG, color: "#e2e8f0", padding: "110px 84px 90px", fontFamily: "Chosun", wordBreak: "keep-all" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, letterSpacing: 6, color: "rgba(226,232,240,.45)" }}>
        <span>CABINET</span>
        <span>서류함에서 건져 올린 {ten.length}곡</span>
      </div>

      {/* 편지 — 따옴표로 */}
      <div style={{ display: "flex", marginTop: 70, fontSize: 64, lineHeight: 1.35, color: "#ffffff" }}>“{q.slice(0, 60)}”</div>
      {keywords.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", marginTop: 30, fontSize: 28, color: ACCENT }}>
          {keywords.slice(0, 5).map((k) => (
            <span key={k} style={{ marginRight: 22 }}>
              #{k}
            </span>
          ))}
        </div>
      )}

      {/* 플로피 10장 — 두 줄 */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", marginTop: 70, rowGap: 24 }}>
        {ten.map((t, i) => (
          <Floppy key={i} title={t.title} artwork={t.artwork} />
        ))}
      </div>

      {/* 파란 곡 목록 */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 64, fontSize: 32, color: ACCENT }}>
        {ten.map((t, i) => (
          <div key={i} style={{ display: "flex", marginBottom: 18, whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ width: 62, opacity: 0.6 }}>{String(i + 1).padStart(2, "0")}</span>
            <span>{t.title.slice(0, 26)}</span>
            <span style={{ marginLeft: 14, opacity: 0.55, fontSize: 24, marginTop: 5 }}>· {t.artist.slice(0, 18)}</span>
          </div>
        ))}
      </div>

      {/* 유튜브 QR — 휴대폰 카메라로 비추면 이 곡들이 유튜브에서 이어서 나온다(흰 바탕 검은 점 — 인식이 잘 되게) */}
      {qr && (
        <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori 는 img 만 그린다 */}
          <img src={qr} width={200} height={200} style={{ borderRadius: 12 }} alt="" />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 36, fontSize: 30, lineHeight: 1.45, color: "rgba(226,232,240,.8)" }}>
            <span>카메라로 비추면</span>
            <span style={{ color: ACCENT }}>유튜브에서 이어 듣기</span>
          </div>
        </div>
      )}

      {/* 신의 한마디 — 영화 자막처럼 */}
      {line && <div style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: "auto", fontSize: 38, lineHeight: 1.4, color: YELLOW, textShadow: OUTLINE }}>{line.slice(0, 70)}</div>}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 48, fontSize: 24, letterSpacing: 4, color: "rgba(226,232,240,.4)" }}>cabinet-flame-zeta.vercel.app</div>
    </div>
  );
}
