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

export function setRefreshTokenCookie(res: Response, rawToken: string, expiresAt: Date): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: COOKIE_PATH,
  });
}

export function readRefreshTokenCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_TOKEN_COOKIE_NAME];
}
