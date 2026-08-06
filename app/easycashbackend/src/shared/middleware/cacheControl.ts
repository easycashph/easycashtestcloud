import type { NextFunction, Request, Response } from 'express';

/**
 * Performance optimization (2026-08-06 user request) - a small `Cache-Control` helper for
 * read-heavy, rarely-changing reference/informational GET endpoints (branches, PSGC address
 * lookups, the automated finance-news feed) that previously hit the database fresh on every single
 * request. Deliberately opt-in per route (not global) - never applied to anything account-specific
 * or write-triggering.
 *
 * `public` is only safe for genuinely public, unauthenticated data (no per-user variance) - an
 * intermediary/CDN (e.g. Cloudflare in front of this backend) is allowed to cache and serve it to
 * other visitors. `private` still lets the requester's own browser cache the response, but tells
 * any shared cache in between (CDN, corporate proxy) never to store or reuse it for a different
 * user - required for anything gated by `requirePortalAuth`, even if the underlying data itself
 * (e.g. the branch list) isn't user-specific, since the Authorization header on the request is.
 */
export function cacheControl(maxAgeSeconds: number, visibility: 'public' | 'private' = 'private') {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Cache-Control', `${visibility}, max-age=${maxAgeSeconds}`);
    next();
  };
}
