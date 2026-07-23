import { Router } from 'express';
import { validateBody } from '@shared/middleware/validate';
import { PublicLoanSigningController, type PublicLoanSigningControllerDeps } from './publicLoanSigningController';
import { signLoanSigningDocumentSchema, verifySigningOtpSchema } from './loanSigningSchemas';

/** UNAUTHENTICATED public routes - no `requireAuth`, no `tokenService` argument (mirrors
 * `smsReminderDlrRouter`'s the-only-other-public-route precedent). Access control lives entirely
 * inside the controller/use cases via the hashed link token + OTP, not a router-level guard. */
export function createPublicLoanSigningRouter(deps: PublicLoanSigningControllerDeps): Router {
  const router = Router();
  const controller = new PublicLoanSigningController(deps);

  router.post('/signing-sessions/:token/request-otp', controller.requestOtp);
  router.post('/signing-sessions/:token/verify-otp', validateBody(verifySigningOtpSchema), controller.verifyOtp);
  router.get('/signing-sessions/:token', controller.getSession);
  router.get('/signing-sessions/:token/documents/:documentId/file', controller.getDocumentFile);
  router.post(
    '/signing-sessions/:token/documents/:documentId/sign',
    validateBody(signLoanSigningDocumentSchema),
    controller.signDocument,
  );

  return router;
}
