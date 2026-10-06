import type { Metadata, Viewport } from "next";
import { Fragment_Mono, Inter, Nanum_Myeongjo } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

/* Main Sans-Serif — UI, 인풋, 데이터 수치. Pretendard 는 CSS 폴백 스택에서 받는다. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/* Concept Serif — 보고서, 점수 인쇄, 라벨지 */
const fragmentMono = Fragment_Mono({
  variable: "--font-fragment",
  weight: "400",
  subsets: ["latin"],
});

/* 편지 — 3번 페이지 편지지. 한글 글리프가 커서 preload 하지 않는다 */
const nanumMyeongjo = Nanum_Myeongjo({
  variable: "--font-nanum",
  weight: ["400", "700"],
  preload: false,
});

/* 자막 — 조선굴림체(조선일보, 무료 배포 폰트). 한글 전체라 2MB 넘어서 preload 하지 않는다 */
const chosunGulim = localFont({
  src: "./fonts/ChosunGu.woff",
  variable: "--font-chosun",
  preload: false,
});

export const metadata: Metadata = {
  title: "cabinet",
  description: "상황과 감정을 적으면 서류함에서 음악을 건져 올려 주는 아카이브",
};

/* 폰 — 노치·홈 막대 자리까지 화면을 쓰고(자막은 CSS env() 로 안전 영역을 피한다), 키보드가 올라오면 화면이 그만큼 줄어든다(안드로이드 크롬.
   아이폰은 이 값을 모른다 — 입력칸을 화면 위쪽에 둬서 키보드에 안 가리게 한다) */
export const viewport: Viewport = {
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${inter.variable} ${fragmentMono.variable} ${nanumMyeongjo.variable} ${chosunGulim.variable} h-full antialiased`}>
      <body>
        {/* 영화 비율 프레임 — 모든 화면이 이 안에서 돌아간다 (globals.css .cinema) */}
        <div className="cinema">{children}</div>
        {/* 자막 띠 — 프레임 아래 검은 영역. 자막은 여기로 옮겨 그린다 */}
        <div id="cinema-sub" className="cinema-sub" />
        {/* Vercel Web Analytics(방문·이탈) — Vercel 대시보드에서 Analytics 를 켜야 이 주소가 산다. 배포에서만 */}
        {process.env.VERCEL && <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />}
      </body>
    </html>
  );
}
