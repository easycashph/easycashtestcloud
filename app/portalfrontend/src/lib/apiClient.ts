/**
 * Thin `fetch` wrapper for the Easycash Portal's `/api/v1/portal/*` backend routes (see
 * app/easycashbackend/src/modules/client-portal/). Deliberately separate from app/frontend's apiClient.ts
 * - this app is a fully separate deployable (GitHub Pages), talking to a different auth realm
 * (PortalAccount, not the internal staff User).
 *
 * Unlike the internal LMS frontend (in-memory-only access token + HttpOnly refresh cookie, same
 * origin as its API), this app stores its access token in localStorage: it's a cross-origin SPA
 * (GitHub Pages -> a separately-hosted backend), so an HttpOnly cross-site cookie would need
 * SameSite=None+Secure and isn't viable before the backend has a real HTTPS origin. This is a
 * deliberate v1 tradeoff (accepts XSS-token-theft risk, standard for many public SPAs) - the
 * portal's own JWT is short-lived-ish (PORTAL_JWT_TTL, 24h) and scoped to a lower-stakes account
 * than a staff login, per the Phase 1 design notes.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
const TOKEN_STORAGE_KEY = 'easycash-portal-token';
/** "Remember this device" (2026-07-30 user request) - deliberately a SEPARATE key from the access
 * token, and never cleared by clearStoredToken()/logout(): the whole point is that it survives a
 * normal logout/login cycle so a future login from this same browser can skip 2FA. */
const DEVICE_TOKEN_STORAGE_KEY = 'easycash-portal-device-token';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** 2026-07-30 (bug found in production testing): a corrupted/stale localStorage value - the
 * literal string "undefined" (from a prior `setStoredToken(undefined)` call, e.g. before a fix
 * elsewhere, or from an interrupted login) - was being sent as `Authorization: Bearer undefined`
 * on every request, silently failing every authenticated call while the app still believed it was
 * logged in. Treat these literal strings as "no token" (and clear them) rather than trusting
 * whatever's in localStorage at face value. */
export function getStoredToken(): string | null {
  const value = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!value || value === 'undefined' || value === 'null') {
    if (value) localStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
  return value;
}

export function setStoredToken(token: string): void {
  if (!token) return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/** "Remember this device" (2026-07-30). */
export function getStoredDeviceToken(): string | null {
  const value = localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
  return value && value !== 'undefined' && value !== 'null' ? value : null;
}

export function setStoredDeviceToken(token: string): void {
  if (!token) return;
  localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, token);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth !== false) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // 2026-07-30: a 401 on an authenticated call means the stored token is missing/invalid/expired
    // - clear it rather than leaving the app stuck believing it's logged in while every
    // authenticated call keeps silently failing (the bug this was found from).
    if (res.status === 401 && options.auth !== false) {
      clearStoredToken();
      window.dispatchEvent(new Event('easycash-portal-session-expired'));
    }
    const code = data?.error?.code ?? 'UNKNOWN_ERROR';
    const message = data?.error?.message ?? 'Something went wrong. Please try again.';
    throw new ApiError(res.status, code, message);
  }

  return data as T;
}

/** Multipart upload (loan application document attachments) - always authenticated, so it doesn't
 * share `request()`'s JSON `Content-Type` header (the browser sets the multipart boundary itself). */
async function postFile<T>(path: string, file: File, fields: Record<string, string> = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const formData = new FormData();
  formData.append('file', file);
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);

  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const code = data?.error?.code ?? 'UNKNOWN_ERROR';
    const message = data?.error?.message ?? 'Something went wrong. Please try again.';
    throw new ApiError(res.status, code, message);
  }

  return data as T;
}

/** Binary download (e.g. a profile picture attachment) - the endpoint requires a Bearer auth
 * header, so a plain `<img src>` can't hit it directly; fetched as a blob and rendered via an
 * object URL (same pattern as the internal LMS frontend's own fetchFileBlob). */
export async function fetchFileBlob(path: string): Promise<Blob> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'Could not download the file.');
  return res.blob();
}

/**
 * Fetches a binary response (e.g. a Statement of Account PDF) and triggers the browser's normal
 * save-file flow (2026-08-06, "My Statement of Account") - needed because the endpoint requires a
 * Bearer token header, which a plain `<a href>` navigation can't send. Mirrors the internal LMS
 * frontend's own `downloadFile` helper.
 */
export async function downloadFile(path: string, fallbackFileName: string): Promise<void> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'Could not download the file.');

  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const fileName = match?.[1] ? decodeURIComponent(match[1]) : fallbackFileName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, auth = false): Promise<T> => request<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown, auth = false): Promise<T> => request<T>(path, { method: 'PATCH', body, auth }),
  delete: <T>(path: string, auth = false): Promise<T> => request<T>(path, { method: 'DELETE', auth }),
  postFile: <T>(path: string, file: File, fields?: Record<string, string>): Promise<T> => postFile<T>(path, file, fields),
};
