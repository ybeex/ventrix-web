// API client. Implements the protocols in FRONTEND-INTEGRATION.md:
//  - bearer token held in memory only (SECURITY.md: avoid localStorage)
//  - any 401 on an authenticated call ends the session (no retry)
//  - one Idempotency-Key per user intent, reused on every retry; 429/503 back off and retry with the same key
//  - one error envelope: { error: { code, message, requestId, details? } }

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string, public details?: { instancePath: string; message: string }[]) {
    super(message);
  }
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details ?? []) out[d.instancePath.replace(/^\//, '').split('/')[0] || '_'] = d.message;
    return out;
  }
}

let token: string | null = null;
let onUnauthorized: () => void = () => {};
export const setToken = (t: string | null) => { token = t; };
export const getToken = () => token;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export const newKey = () => crypto.randomUUID();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Result<T> { status: number; data: T; replayed: boolean }

export async function request<T>(method: string, path: string, opts: { body?: unknown; query?: Record<string, unknown>; key?: string; auth?: boolean; keepSessionOn401?: boolean } = {}): Promise<Result<T>> {
  const { body, query, key, auth = true, keepSessionOn401 = false } = opts;
  const qs = query ? Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&') : '';
  const url = `${BASE}/v1${path}${qs ? `?${qs}` : ''}`;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth && token) headers.authorization = `Bearer ${token}`;
  if (key) headers['idempotency-key'] = key;

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      // Network failure: a keyed write is safe to retry with the same key.
      if (key && attempt < 2) { await sleep(600 * (attempt + 1)); continue; }
      throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
    }
    if ((res.status === 429 || res.status === 503) && attempt < 3 && (key || method === 'GET')) {
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Math.min(5000, (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 800 * (attempt + 1))));
      continue;
    }
    if (res.status === 409 && key && attempt < 3) {
      const peek = await res.clone().json().catch(() => null);
      if (peek?.error?.code === 'REQUEST_IN_PROGRESS') { await sleep(700); continue; }
    }
    const text = await res.text();
    const json = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
    if (!res.ok) {
      if (res.status === 401 && auth && token && !keepSessionOn401) { onUnauthorized(); }
      const e = json?.error;
      throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? `Request failed (${res.status})`, e?.requestId, e?.details);
    }
    return { status: res.status, data: json as T, replayed: res.headers.get('idempotent-replayed') === 'true' };
  }
}

export const get = async <T,>(path: string, query?: Record<string, unknown>) => (await request<T>('GET', path, { query })).data;
export const post = <T,>(path: string, body?: unknown, key?: string) => request<T>('POST', path, { body: body ?? {}, key });
export const put = async <T,>(path: string, body?: unknown) => (await request<T>('PUT', path, { body })).data;
export const patch = async <T,>(path: string, body?: unknown) => (await request<T>('PATCH', path, { body })).data;
export const del = async <T,>(path: string) => (await request<T>('DELETE', path)).data;

// Authenticated file download (CSV): the bearer header cannot ride on a plain link, so fetch then save the blob.
export async function download(path: string, query: Record<string, unknown>, filename: string) {
  const qs = Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  const res = await fetch(`${BASE}/v1${path}?${qs}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const j = await res.json().catch(() => null);
    throw new ApiError(res.status, j?.error?.code ?? 'ERROR', j?.error?.message ?? `Download failed (${res.status})`, j?.error?.requestId);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// multipart upload (the browser sets the boundary, so no content-type header here)
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}/v1${path}`, { method: 'POST', body: form, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const e = json?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? `Upload failed (${res.status})`, e?.requestId, e?.details);
  }
  return json as T;
}

// Authenticated binary fetch (e.g. the item QR image): an <img src> cannot carry the bearer header.
export async function fetchBlob(path: string, query?: Record<string, unknown>): Promise<Blob> {
  const qs = query ? Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&') : '';
  const res = await fetch(`${BASE}/v1${path}${qs ? `?${qs}` : ''}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, 'ERROR', `Request failed (${res.status})`);
  }
  return res.blob();
}
