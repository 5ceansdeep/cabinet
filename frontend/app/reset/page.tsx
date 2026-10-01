import AuthFlow from "@/components/landing/AuthFlow";

/* 새 열쇠 — 재설정 메일의 링크(/reset?token=…)로 들어와 새 비밀번호를 정한다 */
export default async function ResetPage({ searchParams }: PageProps<"/reset">) {
  const { token } = await searchParams;
  return <AuthFlow mode="reset" token={typeof token === "string" ? token : ""} />;
}
