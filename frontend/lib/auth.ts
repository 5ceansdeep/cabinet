import { api, getToken, setToken } from "./api";

/* 인증 — 백엔드 /auth (bcrypt + JWT 7일). 출입증은 lib/api 가 localStorage 에 두고 요청마다 붙인다.
   백엔드는 계정 없음/비밀번호 틀림을 구분해 주지 않는다 — 누가 가입했는지 흘리지 않게. 그래서 로그인 실패는 전부 "wrong" */

// greet — 환영 인사를 이름까지 부르는 음성 id(백엔드 /voice/:id). 음성이 꺼져 있으면 null — 이름 없는 녹음을 튼다(landing/lines.ts)
export type AuthResult = { ok: true; nickname: string; greet: string | null } | { ok: false; reason: "wrong" | "noAccount" | "emailTaken" | "expired" | "server" };
type Token = { accessToken: string; user: { id: string; email: string; nickname: string }; greet?: string | null };

const SESSION = "cabinet.session"; // 닉네임 — "또 왔군" 인사용
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
  return { ok: true, nickname: r.data.user.nickname, greet: r.data.greet ?? null };
}

export const login = (email: string, password: string) =>
  enter("/auth/login", { email, password }, () => ({ ok: false, reason: "wrong" }));

export const signup = (email: string, nickname: string, password: string) =>
  enter("/auth/signup", { email, nickname, password }, (s) => ({ ok: false, reason: s === 409 ? "emailTaken" : "server" }));

/* 회원가입 첫 칸에서 바로 — 이미 가입된 이메일인가. 서버에 못 닿으면 null(모름) — 그땐 마지막에 가입하며 다시 걸러진다 */
export async function emailTaken(email: string): Promise<boolean | null> {
  const r = await api<{ taken: boolean }>("/auth/check-email", { method: "POST", body: { email } });
  return r.ok ? r.data.taken : null;
}

// 계정 존재 여부와 상관없이 같은 결과 — 가입 여부를 흘리지 않는다. 있으면 백엔드가 30분짜리 재설정 링크를 메일로
export async function requestReset(email: string): Promise<{ ok: boolean }> {
  const [r] = await Promise.all([api<{ ok: boolean }>("/auth/forgot", { method: "POST", body: { email } }), wait(MIN_MS)]);
  return { ok: r.ok };
}

// 메일 링크의 토큰으로 새 비밀번호 — 되면 그대로 들어간다. 토큰이 틀렸거나 30분이 지나면 expired
export const resetPassword = (token: string, password: string) =>
  enter("/auth/reset", { token, password }, (s) => ({ ok: false, reason: s === 400 ? "expired" : "server" }));

/* 세션 — 이미 들어온 적 있으면 닉네임. useSyncExternalStore 로 읽는다 */
// 출입증이 없으면(예전 가짜 인증 시절 세션 등) 들어온 적 없는 것으로 본다
export const getSession = () => (getToken() ? load(SESSION) : null);
export const clearSession = () => {
  save(SESSION, null);
  setToken(null);
};
/* 출입증이 아직 유효한지 서버에 확인한다 — 토큰이 있기만 하면 들어온 걸로 보면, 계정이 지워졌거나 서명 키가 바뀐 뒤에도
   "또 왔군" 하고 들어가 버린다. 401 이면 흔적을 지우고, 서버에 못 닿으면(오프라인) 그대로 둔다.
   돌려주는 값 = "또 왔군" 을 이름까지 부르는 음성 id(없으면 null) */
export async function checkSession(): Promise<string | null> {
  if (!getToken()) return null;
  const r = await api<{ nickname: string; greet?: string | null }>("/auth/me");
  if (r.ok) save(SESSION, r.data.nickname);
  else if (r.status === 401) clearSession();
  return r.ok ? (r.data.greet ?? null) : null;
}

export function subscribeSession(cb: () => void) {
  addEventListener("storage", cb);
  return () => removeEventListener("storage", cb);
}


