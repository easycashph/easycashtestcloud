import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '@shared/config/env';
import { cacheControl } from '@shared/middleware/cacheControl';
import { ExternalNewsLinkController, type ExternalNewsLinkControllerDeps } from './externalNewsLinkController';

/** Same rate-limiting posture as the portal auth routes' own `makeLimiter` (portalAuthRouter.ts) -
 * this endpoint is public/unauthenticated, so it has no per-account throttling otherwise, and the
 * data behind it barely changes (fetched once a day) making it an easy scraping/DoS-cost target
 * without its own limit (2026-08-06 security audit finding). Relaxed in development for repeated
 * manual/automated preview testing, same reasoning as every other limiter in this codebase. */
const financeNewsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'development' ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } },
});

/**
 * Automated PH Lending/Finance News + Road/Weather Advisory feed (2026-08-06 user request) -
 * public, unauthenticated (no `requirePortalAuth`), same posture as `portalPsgcRouter.ts`:
 * reference/informational content, not account-specific, readable by a visitor who hasn't signed
 * up yet. Mounted at the same /api/v1/portal prefix as every other portal router.
 *
 * `cacheControl(3600, 'public')` (2026-08-06 performance audit) - the underlying data is refreshed
 * by a daily cron (see financeNewsScheduler.ts), so serving a hard-cached copy for up to an hour
 * (browser AND any CDN/edge cache in front, e.g. Cloudflare) is safe and removes a full DB round
 * trip from most repeat visits - this was previously hitting the database fresh on every request.
 */
export function createExternalNewsLinkRouter(deps: ExternalNewsLinkControllerDeps): Router {
  const router = Router();
  const controller = new ExternalNewsLinkController(deps);

  router.get('/finance-news', financeNewsLimiter, cacheControl(3600, 'public'), controller.list);

  return router;
}
