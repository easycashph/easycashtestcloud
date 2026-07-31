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
  portalResendLoginOtpSchema,
  portalResendSignUpOtpSchema,
  portalSignUpSchema,
  portalVerifyLoginOtpSchema,
  portalVerifySignUpSchema,
} from './portalAuthSchemas';

/** Same brute-force-protection posture as identity's loginRateLimiter/verifyOtpRateLimiter -
 * guessing a password or a 6-digit OTP is exactly the threat this class of limiter exists for.
 * Relaxed in development for the same reason identity's own limiters are (repeated manual/
 * automated preview testing). */
function makeLimiter(message: string, limit = 8) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.NODE_ENV === 'development' ? 1000 : limit,
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
  router.post(
    '/resend-signup-otp',
    makeLimiter('Too many resend attempts. Please wait a few minutes.', 3),
    validateBody(portalResendSignUpOtpSchema),
    controller.resendSignUpOtp,
  );
  router.post('/login', makeLimiter('Too many login attempts. Try again later.'), validateBody(portalLoginSchema), controller.login);
  router.post(
    '/verify-login-otp',
    makeLimiter('Too many attempts. Try again later.'),
    validateBody(portalVerifyLoginOtpSchema),
    controller.verifyLoginOtp,
  );
  router.post(
    '/resend-login-otp',
    // Tighter limit than the other OTP routes (3, not 8) - this one exists purely to trigger extra
    // real message sends, so it's the one most worth capping harder against abuse/cost.
    makeLimiter('Too many resend attempts. Please wait a few minutes.', 3),
    validateBody(portalResendLoginOtpSchema),
    controller.resendLoginOtp,
  );
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
