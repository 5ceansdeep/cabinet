/* ponytail: 가짜 인증 — 백엔드 auth 모듈(JWT) 생기면 이 파일의 함수 몸통만 fetch 로 교체.
   계정은 이 브라우저 localStorage 에만 두고, 비밀번호는 SHA-256 해시로 저장(평문 저장 안 함). 실서비스 보안 아님 */

export type AuthResult = { ok: true; nickname: string } | { ok: false; reason: "wrong" | "noAccount" | "emailTaken" | "server" };
type Accounts = Record<string, { nickname: string; hash: string }>;

const ACCOUNTS = "cabinet.accounts";
const SESSION = "cabinet.session";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hash(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

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
function accounts(): Accounts {
  try {
    return JSON.parse(load(ACCOUNTS) ?? "{}");
  } catch {
    return {};
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  await wait(900);
  if (!navigator.onLine) return { ok: false, reason: "server" };
  const acc = accounts()[email];
  if (!acc) return { ok: false, reason: "noAccount" };
  if (acc.hash !== (await hash(password))) return { ok: false, reason: "wrong" };
  save(SESSION, acc.nickname);
  return { ok: true, nickname: acc.nickname };
}

export async function signup(email: string, nickname: string, password: string): Promise<AuthResult> {
  await wait(900);
  if (!navigator.onLine) return { ok: false, reason: "server" };
  const all = accounts();
  if (all[email]) return { ok: false, reason: "emailTaken" };
  all[email] = { nickname, hash: await hash(password) };
  save(ACCOUNTS, JSON.stringify(all));
  save(SESSION, nickname);
  return { ok: true, nickname };
}

// 계정 존재 여부와 상관없이 같은 결과 — 가입 여부를 흘리지 않는다
export async function requestReset(): Promise<{ ok: boolean }> {
  await wait(900);
  return { ok: navigator.onLine };
}

/* 세션 — 이미 들어온 적 있으면 닉네임. useSyncExternalStore 로 읽는다 */
export const getSession = () => load(SESSION);
export const clearSession = () => save(SESSION, null);
export function subscribeSession(cb: () => void) {
  addEventListener("storage", cb);
  return () => removeEventListener("storage", cb);
}

// 이 브라우저에서 한 번이라도 가입한 적 있나 — 처음 온 사람은 회원가입으로 보낸다
export const hasAccounts = () => Object.keys(accounts()).length > 0;
