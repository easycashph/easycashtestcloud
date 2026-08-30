/**
 * Frontend↔Backend Wiring Pilot, Stage 0a (`docs/Architecture/FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md`).
 *
 * Thin `fetch` wrapper for the real `app/backend` HTTP API - the first code in this frontend that
 * ever calls it. Deliberately NOT a generated client / not axios: the API surface being wired is
 * still small (auth + one pilot screen), so a small hand-written wrapper is easier to reason about
 * than a codegen step.
 *
 * Access token lives in memory only (a module-level variable), never `localStorage`/`sessionStorage`
 * - mirrors the backend's own refresh-token discipline (HttpOnly cookie, never in a JS-readable
 * store). This means a hard page reload always starts from `status: 'loading'` and re-derives a
 * fresh access token via `/auth/refresh` (using the HttpOnly cookie), which is intentional, not a
 * bug - see `roleContext.tsx`'s bootstrap effect.
 */

// 2026-07-11 (user request): derived from the page's own hostname, not hardcoded to "localhost" —
// "localhost" always means "this same device," so a hardcoded value here silently broke every API
// call when the frontend was loaded from a second device via this machine's LAN IP (e.g.
// http://192.168.1.23:5173) instead of localhost, since that other device would try reaching its
// OWN localhost:4000 (nothing there) rather than the machine actually running the backend. Reusing
// window.location.hostname keeps existing localhost-based dev/testing behavior identical.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? `http://${window.location.hostname}:4000/api/v1`;

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

/** "Remember this device" (2026-07-30 user request) - deliberately the ONE exception to this
 * file's own in-memory-only rule above: the whole point is that it survives a page reload and a
 * normal logout/login cycle, which an in-memory variable cannot. Never holds a session credential
 * itself (that's still the HttpOnly refresh cookie) - only a long-lived, single-purpose token that
 * skips the 2FA challenge on a future login, same trust level as "this browser proved it received
 * an OTP here before." */
const DEVICE_TOKEN_STORAGE_KEY = 'easycash-lms-device-token';

export function getStoredDeviceToken(): string | null {
  const value = localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
  return value && value !== 'undefined' && value !== 'null' ? value : null;
}

export function setStoredDeviceToken(token: string): void {
  if (!token) return;
  localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, token);
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Proactive silent refresh (2026-08-06, fixes unexplained auto-logout). Previously the app only
 * refreshed reactively - on a 401 - and never scheduled anything off the `accessTokenExpiresAt`
 * the backend already returns from login/refresh. That meant an access token expiring during a
 * lull (e.g. 15 idle minutes) could line up two independent tabs/requests hitting 401 at nearly
 * the same time, both presenting the same rotating refresh-token cookie to `/auth/refresh` - the
 * backend's rotate-on-use reuse detection then treats the second presentation as theft and
 * revokes the ENTIRE session, which looked to users like a random forced logout.
 *
 * Fix has two parts: (1) schedule a refresh a safety margin *before* actual expiry so the reactive
 * 401 path is rarely exercised at all, and (2) serialize every refresh attempt - scheduled or
 * reactive, in this tab or any other tab of the same browser - behind the Web Locks API. Locks are
 * scoped per-origin across all tabs/windows (not per-tab), and the refresh-token cookie is a
 * genuine browser-level cookie jar shared by every tab of this origin, so once one tab's refresh
 * completes and rotates the cookie, a second tab's queued refresh (running after the lock is
 * released) automatically presents the *new* cookie value and succeeds too - never a stale/reused
 * one. This never changes the backend's rotation/reuse-detection security guarantee; it only
 * removes the false-positive race that was tripping it.
 */
const REFRESH_SAFETY_MARGIN_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 5_000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearScheduledRefresh(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleProactiveRefresh(accessTokenExpiresAt: string): void {
  clearScheduledRefresh();
  const delay = Math.max(new Date(accessTokenExpiresAt).getTime() - Date.now() - REFRESH_SAFETY_MARGIN_MS, MIN_REFRESH_DELAY_MS);
  refreshTimer = setTimeout(() => {
    void refreshAccessToken();
  }, delay);
}

/** Call after every successful login/refresh/OTP-verify - stores the token and (re)schedules the next silent refresh. */
export function applyAuthTokens(token: string, accessTokenExpiresAt: string): void {
  accessToken = token;
  scheduleProactiveRefresh(accessTokenExpiresAt);
}

/** Call on logout / session-expiry - clears the token and cancels any pending scheduled refresh. */
export function clearAuthTokens(): void {
  accessToken = null;
  clearScheduledRefresh();
}

/**
 * Runs `fn` behind a same-origin, cross-tab Web Locks API lock when available, so at most one
 * `/auth/refresh` call is ever in flight across every tab of this browser at once - see the doc
 * comment above `REFRESH_SAFETY_MARGIN_MS`. Falls back to running `fn` directly on browsers
 * without Web Locks support (all real deployment targets here have it, but this keeps the app from
 * breaking rather than relying on a feature every environment must have).
 */
function withCrossTabRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    // `LockManager.request`'s TS typings model the callback as returning `T` synchronously; at
    // runtime it fully supports (and is designed for) an async callback whose returned promise is
    // awaited before the lock releases - the cast below only corrects the type, not the behavior.
    return navigator.locks.request('easycash-lms-auth-refresh', fn) as Promise<T>;
  }
  return fn();
}

/**
 * Fires once whenever a background `/auth/refresh` fails while the app believed it had a live
 * session (i.e. every 401-triggered refresh attempt in `apiRequest`, not the initial bootstrap
 * refresh in `roleContext.tsx`, which has its own try/catch). Without this, a session that goes
 * bad mid-use (refresh token expired, or revoked via the backend's reuse-detection) left
 * `accessToken` permanently `null` with no signal to the rest of the app - every page kept
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
 * they must not each independently call `/auth/refresh` - the backend's refresh-token rotation
 * treats a second concurrent use of the same refresh token as reuse (see backend `RefreshTokenUseCase`
 * C-01 handling) and would revoke the session. All concurrent callers await the same in-flight promise.
 */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = withCrossTabRefreshLock(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          clearAuthTokens();
          return false;
        }
        const body = (await res.json()) as { accessToken: string; accessTokenExpiresAt: string };
        applyAuthTokens(body.accessToken, body.accessTokenExpiresAt);
        return true;
      } catch {
        clearAuthTokens();
        return false;
      } finally {
        refreshPromise = null;
      }
    });
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
    // 304 response to this code - `res.ok` is false for 304 (only 200-299 is "ok"), and a 304 has
    // no body, so it was being misread as a generic failure ("Something went wrong").
    cache: 'no-store',
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
}

/**
 * Runs one API call, transparently refreshing and retrying exactly once on a 401 - the standard
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
  delete: <T>(path: string): Promise<T> => apiRequest<T>(path, { method: 'DELETE' }),
};

/**
 * Multipart upload - deliberately bypasses `apiRequest`'s `JSON.stringify(init.body)` (a `FormData`
 * body must reach `fetch` untouched, and its Content-Type, including the multipart boundary, must
 * be left for the browser to set - never set it manually here). Still shares the same
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
 * Fetches a binary response (e.g. an attachment) as a `Response`, transparently refreshing and
 * retrying once on a 401 - same pattern as `apiRequest`. Shared by `downloadFile` (save-as) and
 * the attachment preview modal (renders the blob inline instead of saving it).
 */
async function fetchFileResponse(path: string): Promise<Response> {
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

  return res;
}

/** Fetches a binary response body as a `Blob` - e.g. for inline attachment preview. */
export async function fetchFileBlob(path: string): Promise<Blob> {
  const res = await fetchFileResponse(path);
  return res.blob();
}

/**
 * Fetches a binary response (e.g. an attachment download) as a Blob, then triggers the browser's
 * normal save-file flow - needed because the endpoint requires a Bearer token header, which a
 * plain `<a href>` navigation can't send.
 */
export async function downloadFile(path: string, fallbackFileName: string): Promise<void> {
  const res = await fetchFileResponse(path);

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
 * include a `limit`/`cursor` query param - this appends them itself.
 *
 * Real datasets here (loan accounts, borrowers, loan products) are in the low thousands, not the
 * 10,000+/100,000+ scale `CLAUDE.md` designs the platform for - looping a handful of 200-row pages
 * once per page load is a deliberate, honest simplification for now, not a claim this scales
 * indefinitely. A genuinely paginated list UI (cursor-driven Next/Previous, not "load everything")
 * is the right fix once a list actually approaches that scale.
 */
/** `onProgress`, when passed, fires after each page lands with the running item count and page
 * number so far - lets a caller show real (not simulated) loading progress for a fetch that may
 * span many pages. Optional and additive - existing callers that don't pass it are unaffected. */
export async function fetchAllPages<T>(
  basePath: string,
  pageSize = 200,
  onProgress?: (loadedCount: number, pageNumber: number) => void,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  let pageNumber = 0;
  do {
    const separator = basePath.includes('?') ? '&' : '?';
    const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const page: CursorPage<T> = await apiClient.get<CursorPage<T>>(`${basePath}${separator}limit=${pageSize}${cursorParam}`);
    items.push(...page.items);
    cursor = page.nextCursor;
    pageNumber++;
    onProgress?.(items.length, pageNumber);
  } while (cursor);
  return items;
}
