import type { Request, Response } from 'express';
import { env } from '@shared/config/env';

/**
 * Milestone 6 plan §5/§8: the refresh token travels ONLY via this cookie —
 * HttpOnly (unreachable from JS, mitigates XSS exfiltration), Secure in
 * production (requires HTTPS), SameSite=Strict (primary CSRF mitigation
 * for the two cookie-bearing routes). Scoped to /api/v1/auth only, so the
 * browser doesn't attach it to unrelated API calls.
 */
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const COOKIE_PATH = '/api/v1/auth';

/** Mirrors `devOriginPattern` in `app.ts` (kept as a separate copy — different module, small
 * enough not to warrant a shared import) — localhost/127.0.0.1/private-LAN origins, i.e. the
 * "everything's on one machine" local dev topology where the browser and this API are same-site
 * for cookie purposes. */
const LOCAL_DEV_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(:\d+)?$/;

/**
 * 2026-08-05 (user-reported bug fix): the refresh cookie used to be a blanket SameSite=Strict,
 * Secure only in production. That silently broke session persistence for the Cloudflare Tunnel +
 * Cloudflare Pages deployment (`easycash-lms.pages.dev` calling a `*.trycloudflare.com` backend) —
 * genuinely different sites, so a Strict cookie is NEVER sent on that cross-site `/auth/refresh`
 * call no matter how correct CORS is (SameSite is a browser-enforced policy independent of CORS
 * headers). The access token then expired every 15 minutes with no way to silently renew it,
 * forcing a full relogin — see `apiClient.ts`'s `refreshAccessToken()`, which was always failing.
 *
 * Fix: decide per-request from the `Origin` header, not a static NODE_ENV flag — this same backend
 * process serves BOTH plain-http local dev AND the cross-site tunnel simultaneously, so one static
 * setting can't be correct for both at once. A known local-dev origin keeps the stricter same-site
 * policy (works over plain HTTP, tightest CSRF protection this app has); any other origin (the
 * Cloudflare Pages domains in CORS_ORIGIN) gets `SameSite=None` + `Secure` — required together,
 * since browsers reject a `SameSite=None` cookie that isn't also `Secure`. `Secure` still works
 * correctly here regardless of what protocol this Express process itself sees on the wire (plain
 * http from the local cloudflared hop) — the browser's Secure check is based on ITS OWN connection
 * to the public `https://*.trycloudflare.com` / `https://*.pages.dev` URL, not this server's view.
 */
function isCrossSiteRequest(req: Request): boolean {
  const origin = req.header('origin');
  return !!origin && !LOCAL_DEV_ORIGIN_PATTERN.test(origin);
}

function refreshCookieOptions(req: Request): { httpOnly: true; secure: boolean; sameSite: 'strict' | 'none'; path: string } {
  const crossSite = isCrossSiteRequest(req);
  return {
    httpOnly: true,
    secure: crossSite || env.NODE_ENV === 'production',
    sameSite: crossSite ? 'none' : 'strict',
    path: COOKIE_PATH,
  };
}

export function setRefreshTokenCookie(req: Request, res: Response, rawToken: string, expiresAt: Date): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, rawToken, { ...refreshCookieOptions(req), expires: expiresAt });
}

export function clearRefreshTokenCookie(req: Request, res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshCookieOptions(req));
}

export function readRefreshTokenCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_TOKEN_COOKIE_NAME];
}
