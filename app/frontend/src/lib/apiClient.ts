/**
 * Frontend↔Backend Wiring Pilot, Stage 0a (`docs/Architecture/FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md`).
 *
 * Thin `fetch` wrapper for the real `app/backend` HTTP API — the first code in this frontend that
 * ever calls it. Deliberately NOT a generated client / not axios: the API surface being wired is
 * still small (auth + one pilot screen), so a small hand-written wrapper is easier to reason about
 * than a codegen step.
 *
 * Access token lives in memory only (a module-level variable), never `localStorage`/`sessionStorage`
 * — mirrors the backend's own refresh-token discipline (HttpOnly cookie, never in a JS-readable
 * store). This means a hard page reload always starts from `status: 'loading'` and re-derives a
 * fresh access token via `/auth/refresh` (using the HttpOnly cookie), which is intentional, not a
 * bug — see `roleContext.tsx`'s bootstrap effect.
 */

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly ruleId?: string;

  constructor(status: number, code: string, message: string, ruleId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.ruleId = ruleId;
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Fires once whenever a background `/auth/refresh` fails while the app believed it had a live
 * session (i.e. every 401-triggered refresh attempt in `apiRequest`, not the initial bootstrap
 * refresh in `roleContext.tsx`, which has its own try/catch). Without this, a session that goes
 * bad mid-use (refresh token expired, or revoked via the backend's reuse-detection) left
 * `accessToken` permanently `null` with no signal to the rest of the app — every page kept
 * rendering as if logged in, but every request 401'd forever with no way to recover except a
 * manual hard reload. `roleContext.tsx`'s `RoleProvider` subscribes to this to bounce the user
 * back to the Login page immediately instead.
 */
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(callback: (() => void) | null): void {
  onSessionExpired = callback;
}

/**
 * De-duplicates concurrent refresh attempts: if three requests all get a 401 at the same moment,
 * they must not each independently call `/auth/refresh` — the backend's refresh-token rotation
 * treats a second concurrent use of the same refresh token as reuse (see backend `RefreshTokenUseCase`
 * C-01 handling) and would revoke the session. All concurrent callers await the same in-flight promise.
 */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          accessToken = null;
          return false;
        }
        const body = (await res.json()) as { accessToken: string };
        accessToken = body.accessToken;
        return true;
      } catch {
        accessToken = null;
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Extra headers beyond Authorization/Content-Type, e.g. Idempotency-Key. */
  headers?: Record<string, string>;
}

async function rawRequest(path: string, init: ApiRequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const hasBody = init.body !== undefined;
  if (hasBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    // Disables conditional (ETag/If-None-Match) caching. Without this, two identical GETs fired
    // close together (e.g. React StrictMode's dev-mode double-invoke of effects) can surface a raw
    // 304 response to this code — `res.ok` is false for 304 (only 200-299 is "ok"), and a 304 has
    // no body, so it was being misread as a generic failure ("Something went wrong").
    cache: 'no-store',
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
}

/**
 * Runs one API call, transparently refreshing and retrying exactly once on a 401 — the standard
 * rotation-aware interceptor pattern this backend's cookie-based refresh flow expects. A second
 * 401 (after a successful refresh) is a real auth failure, not retried again.
 */
async function apiRequest<T>(path: string, init: ApiRequestInit = {}, allowRefreshRetry = true): Promise<T> {
  const res = await rawRequest(path, init);

  if (res.status === 401 && allowRefreshRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, init, false);
    }
    onSessionExpired?.();
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  const data: unknown = contentType.includes('application/json') ? await res.json() : undefined;

  if (!res.ok) {
    const errorBody = (data as { error?: { code?: string; message?: string; ruleId?: string } } | undefined)?.error;
    throw new ApiError(
      res.status,
      errorBody?.code ?? 'UNKNOWN_ERROR',
      errorBody?.message ?? 'Something went wrong. Please try again.',
      errorBody?.ruleId,
    );
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> =>
    apiRequest<T>(path, { method: 'POST', body, headers }),
  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> =>
    apiRequest<T>(path, { method: 'PATCH', body, headers }),
};

/**
 * Multipart upload — deliberately bypasses `apiRequest`'s `JSON.stringify(init.body)` (a `FormData`
 * body must reach `fetch` untouched, and its Content-Type, including the multipart boundary, must
 * be left for the browser to set — never set it manually here). Still shares the same
 * Authorization/credentials/refresh-retry behavior as every other authenticated call.
 */
export async function uploadFile<T>(path: string, formData: FormData, allowRefreshRetry = true): Promise<T> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    cache: 'no-store',
    body: formData,
  });

  if (res.status === 401 && allowRefreshRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return uploadFile<T>(path, formData, false);
    onSessionExpired?.();
  }

  const contentType = res.headers.get('content-type') ?? '';
  const data: unknown = contentType.includes('application/json') ? await res.json() : undefined;

  if (!res.ok) {
    const errorBody = (data as { error?: { code?: string; message?: string; ruleId?: string } } | undefined)?.error;
    throw new ApiError(
      res.status,
      errorBody?.code ?? 'UNKNOWN_ERROR',
      errorBody?.message ?? 'Something went wrong. Please try again.',
      errorBody?.ruleId,
    );
  }

  return data as T;
}

/**
 * Fetches a binary response (e.g. an attachment download) as a Blob, then triggers the browser's
 * normal save-file flow — needed because the endpoint requires a Bearer token header, which a
 * plain `<a href>` navigation can't send.
 */
export async function downloadFile(path: string, fallbackFileName: string): Promise<void> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let res = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: 'include', cache: 'no-store' });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
      res = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: 'include', cache: 'no-store' });
    } else {
      onSessionExpired?.();
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'Could not download the file.');
  }

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

interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Loops a cursor-paginated `GET` endpoint (max `limit=200` per page, per `pagination.ts`'s
 * `MAX_LIMIT`) until `nextCursor` is null, returning every item. `basePath` must not already
 * include a `limit`/`cursor` query param — this appends them itself.
 *
 * Real datasets here (loan accounts, borrowers, loan products) are in the low thousands, not the
 * 10,000+/100,000+ scale `CLAUDE.md` designs the platform for — looping a handful of 200-row pages
 * once per page load is a deliberate, honest simplification for now, not a claim this scales
 * indefinitely. A genuinely paginated list UI (cursor-driven Next/Previous, not "load everything")
 * is the right fix once a list actually approaches that scale.
 */
export async function fetchAllPages<T>(basePath: string, pageSize = 200): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const separator = basePath.includes('?') ? '&' : '?';
    const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const page: CursorPage<T> = await apiClient.get<CursorPage<T>>(`${basePath}${separator}limit=${pageSize}${cursorParam}`);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}
