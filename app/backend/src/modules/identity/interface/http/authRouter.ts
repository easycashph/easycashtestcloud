import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { AuthController, type AuthControllerDeps } from './authController';
import { loginSchema } from './authSchemas';

/**
 * Milestone 6 plan §4/§8: stricter than the global rate limiter already
 * mounted in app.ts — specifically protects the login endpoint against
 * brute-force/credential-stuffing attempts.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' } },
});

/**
 * 2026-07-08 (L-6 fix). `/refresh` handles session continuation — an
 * equally sensitive operation to `/login` — but previously relied only on
 * the global app-wide limiter (300/15min), a materially weaker throttle
 * than login's dedicated 8/15min. Set higher than login's limit (a single
 * legitimate client can legitimately refresh more than 8 times per 15
 * minutes across multiple tabs/devices) but still a real, endpoint-specific
 * ceiling on how many refresh attempts — valid or guessed — an attacker can
 * make. Reuse-detection (identity module) still handles the *consequence*
 * of a stolen/replayed token; this limits the *volume* of attempts.
 */
const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many refresh attempts. Try again later.' } },
});

export function createAuthRouter(deps: AuthControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new AuthController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/login', loginRateLimiter, validateBody(loginSchema), controller.login);
  router.post('/refresh', refreshRateLimiter, controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', requireAuth, controller.logoutAll);
  router.get('/me', requireAuth, controller.me);

  return router;
}
