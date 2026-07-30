import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '@shared/config/env';
import { validateBody } from '@shared/middleware/validate';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { createRequirePortalAuth } from './requirePortalAuth';
import { PortalAuthController, type PortalAuthControllerDeps } from './portalAuthController';
import {
  portalConfirmPasswordResetSchema,
  portalLoginSchema,
  portalRequestPasswordResetSchema,
  portalSignUpSchema,
  portalVerifySignUpSchema,
} from './portalAuthSchemas';

/** Same brute-force-protection posture as identity's loginRateLimiter/verifyOtpRateLimiter -
 * guessing a password or a 6-digit OTP is exactly the threat this class of limiter exists for.
 * Relaxed in development for the same reason identity's own limiters are (repeated manual/
 * automated preview testing). */
function makeLimiter(message: string) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.NODE_ENV === 'development' ? 1000 : 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message } },
  });
}

export function createPortalAuthRouter(deps: PortalAuthControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalAuthController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.post('/signup', makeLimiter('Too many sign-up attempts. Try again later.'), validateBody(portalSignUpSchema), controller.signUp);
  router.post(
    '/verify-signup',
    makeLimiter('Too many attempts. Try again later.'),
    validateBody(portalVerifySignUpSchema),
    controller.verifySignUp,
  );
  router.post('/login', makeLimiter('Too many login attempts. Try again later.'), validateBody(portalLoginSchema), controller.login);
  router.post(
    '/forgot-password',
    makeLimiter('Too many attempts. Try again later.'),
    validateBody(portalRequestPasswordResetSchema),
    controller.requestPasswordReset,
  );
  router.post(
    '/reset-password',
    makeLimiter('Too many attempts. Try again later.'),
    validateBody(portalConfirmPasswordResetSchema),
    controller.confirmPasswordReset,
  );
  router.get('/me', requirePortalAuth, controller.me);

  return router;
}
