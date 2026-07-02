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

export function createAuthRouter(deps: AuthControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new AuthController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/login', loginRateLimiter, validateBody(loginSchema), controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', requireAuth, controller.logoutAll);
  router.get('/me', requireAuth, controller.me);

  return router;
}
