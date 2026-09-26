import { api, getToken, setToken } from "./api";

/* 인증 — 백엔드 /auth (bcrypt + JWT 7일). 출입증은 lib/api 가 localStorage 에 두고 요청마다 붙인다.
   백엔드는 계정 없음/비밀번호 틀림을 구분해 주지 않는다 — 누가 가입했는지 흘리지 않게. 그래서 로그인 실패는 전부 "wrong" */

export type AuthResult = { ok: true; nickname: string } | { ok: false; reason: "wrong" | "noAccount" | "emailTaken" | "server" };
type Token = { accessToken: string; user: { id: string; email: string; nickname: string } };

const SESSION = "cabinet.session"; // 닉네임 — "또 왔군" 인사용
const KNOWN = "cabinet.known"; // 이 브라우저에서 들어온 적 있나 — 처음 온 사람은 회원가입으로
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function load(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

// 서랍이 "대조 중" 대사를 한마디는 할 수 있게 — 응답이 빨라도 이만큼은 기다린다
const MIN_MS = 700;

async function enter(path: string, body: object, fail: (status: number) => AuthResult): Promise<AuthResult> {
  const [r] = await Promise.all([api<Token>(path, { method: "POST", body }), wait(MIN_MS)]);
  if (!r.ok) return r.status === 0 || r.status >= 500 ? { ok: false, reason: "server" } : fail(r.status);
  setToken(r.data.accessToken);
  save(SESSION, r.data.user.nickname);
  save(KNOWN, "1");
  return { ok: true, nickname: r.data.user.nickname };
}

export const login = (email: string, password: string) =>
  enter("/auth/login", { email, password }, () => ({ ok: false, reason: "wrong" }));

export const signup = (email: string, nickname: string, password: string) =>
  enter("/auth/signup", { email, nickname, password }, (s) => ({ ok: false, reason: s === 409 ? "emailTaken" : "server" }));

// 계정 존재 여부와 상관없이 같은 결과 — 가입 여부를 흘리지 않는다
// ponytail: 메일 발송 없음 — 백엔드에 재설정 메일(토큰 링크)이 생기면 여기서 POST
export async function requestReset(): Promise<{ ok: boolean }> {
  await wait(900);
  return { ok: navigator.onLine };
}

/* 세션 — 이미 들어온 적 있으면 닉네임. useSyncExternalStore 로 읽는다 */
// 출입증이 없으면(예전 가짜 인증 시절 세션 등) 들어온 적 없는 것으로 본다
export const getSession = () => (getToken() ? load(SESSION) : null);
export const clearSession = () => {
  save(SESSION, null);
  setToken(null);
};
export function subscribeSession(cb: () => void) {
  addEventListener("storage", cb);
  return () => removeEventListener("storage", cb);
}

// 이 브라우저에서 한 번이라도 가입한 적 있나 — 처음 온 사람은 회원가입으로 보낸다
export const hasAccounts = () => load(KNOWN) === "1";

/* 회원가입으로 보내는 건 이 브라우저에서 딱 한 번만 — 두 번째부터는 로그인 화면에 머문다.
   안 그러면 다른 기기에서 가입했거나 저장소를 지운 사람은 "로그인" 을 눌러도 계속 가입 화면으로 튕긴다 */
const SENT = "cabinet.sentToSignup";
export function sendToSignupOnce() {
  if (load(SENT)) return false;
  save(SENT, "1");
  return true;
}
