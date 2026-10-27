import { API } from "./constants.js";
import { getToken, clearSession } from "./auth.js";

let onUnauthorized = null;

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  const token = getToken();
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API}${path}`, opts);

  if (res.status === 401) {
    clearSession();
    if (onUnauthorized) onUnauthorized();
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const GET = (p) => api("GET", p);
export const POST = (p, b) => api("POST", p, b);
export const PUT = (p, b) => api("PUT", p, b);
export const DELETE = (p) => api("DELETE", p);
