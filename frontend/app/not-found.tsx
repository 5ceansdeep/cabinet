import Link from "next/link";
import { PAGE_DIALOGUE as D } from "@/components/landing/lines";

/* 없는 주소·없는 서랍(/s/:id)·꺼 둔 보고서 — Next 기본 404(테마 없음) 대신 편지 화면과 같은 흰 종이 한 장 */
export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-white px-4 text-foreground">
      <section className="flex w-full max-w-md flex-col items-center gap-4 rounded-ui bg-white px-8 py-12 text-center font-letter shadow-[0_2px_6px_rgba(0,0,0,.04),0_30px_80px_rgba(0,0,0,.08)] animate-[appear_.3s_both]">
        <h1 className="text-xl">{D.NOT_FOUND}</h1>
        <p className="text-sm text-black/65">{D.NOT_FOUND_SUB}</p>
        <Link href="/search" className="btn mt-4">
          {D.WRITE}
        </Link>
      </section>
    </main>
  );
}
