import type { Metadata } from "next";
import { Fragment_Mono, Inter, Nanum_Myeongjo } from "next/font/google";
import localFont from "next/font/local";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${inter.variable} ${fragmentMono.variable} ${nanumMyeongjo.variable} ${chosunGulim.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
