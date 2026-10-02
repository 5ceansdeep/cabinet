import { redirect } from "next/navigation";

// 등록은 들어가기(/)에 합쳤다 — 이메일만 넣으면 가입 여부로 갈래가 나뉜다(10/2). 옛 링크는 처음 화면으로
export default function SignupPage() {
  redirect("/");
}
