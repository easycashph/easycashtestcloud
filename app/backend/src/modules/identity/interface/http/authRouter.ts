import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '@shared/config/env';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { AuthController, type AuthControllerDeps } from './authController';
import { loginSchema, verifyLoginOtpSchema } from './authSchemas';

/**
 * Milestone 6 plan §4/§8: stricter than the global rate limiter already
 * mounted in app.ts — specifically protects the login endpoint against
 * brute-force/credential-stuffing attempts.
 *
 * 2026-07-10: kept tight in production AND in the automated test suite (see
 * `tests/integration/auth.test.ts`'s "trips the login rate limiter" case,
 * which asserts the strict 8/15min ceiling) — relaxed only for local
 * `development`, where repeated manual/automated UI-preview testing kept
 * tripping the production limit, which isn't the threat this limiter exists
 * to stop. Never disabled entirely (CLAUDE.md "Rate Limiting" is a required
 * security control) — just a much higher ceiling in development specifically.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'development' ? 1000 : 8,
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

/** Settings > Security > Two-Factor Authentication (2026-07-22) - same ceiling as `/login` itself:
 * guessing a 6-digit OTP is exactly the brute-force threat this class of limiter exists for. */
const verifyOtpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'development' ? 1000 : 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } },
});

export function createAuthRouter(deps: AuthControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new AuthController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/login', loginRateLimiter, validateBody(loginSchema), controller.login);
  router.post('/verify-login-otp', verifyOtpRateLimiter, validateBody(verifyLoginOtpSchema), controller.verifyLoginOtp);
  router.post('/refresh', refreshRateLimiter, controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', requireAuth, controller.logoutAll);
  router.get('/me', requireAuth, controller.me);
  router.get('/sessions', requireAuth, controller.listSessions);
  router.delete('/sessions/:id', requireAuth, controller.revokeSession);

  return router;
}
