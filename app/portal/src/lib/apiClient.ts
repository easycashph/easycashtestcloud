/**
 * Thin `fetch` wrapper for the Easycash Portal's `/api/v1/portal/*` backend routes (see
 * app/backend/src/modules/client-portal/). Deliberately separate from app/frontend's apiClient.ts
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
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
const TOKEN_STORAGE_KEY = 'easycash-portal-token';

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

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
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

export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, auth = false): Promise<T> => request<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown, auth = false): Promise<T> => request<T>(path, { method: 'PATCH', body, auth }),
  postFile: <T>(path: string, file: File, fields?: Record<string, string>): Promise<T> => postFile<T>(path, file, fields),
};
