/* 백엔드(:4000) 부르기 — 로그인하면 받은 출입증(JWT)을 붙인다. 서버가 없거나 실패하면 null */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const apiUrl = (path: string) => `${BASE}${path}`; // <audio src> 처럼 fetch 를 안 거치는 곳
const TOKEN = "cabinet.token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN);
  } catch {
    return null;
  }
};
export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN, t);
    else localStorage.removeItem(TOKEN);
  } catch {}
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number }; // status 0 = 서버에 닿지 못함

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const token = typeof window === "undefined" ? null : getToken();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}
