import { Router } from 'express';
import { validateBody } from '@shared/middleware/validate';
import type { IPortalTokenService } from '@modules/client-portal/application/ports/IPortalTokenService';
import { createRequirePortalAuth } from '@modules/client-portal/interface/http/requirePortalAuth';
import { PortalLoanSigningController, type PortalLoanSigningControllerDeps } from './portalLoanSigningController';
import { signLoanSigningDocumentSchema, verifySigningOtpSchema } from './loanSigningSchemas';

/** 2026-08-20 (Portal e-signature, user request): e-signature reachable from inside the Easycash
 * Portal for a logged-in borrower - no mailed link/token needed, `requirePortalAuth` + an
 * ownership check (`resolvePortalSigningSession`) replaces the token as the access-control
 * mechanism, OTP verification is kept as an additional identity-proof step. Mounted at
 * `/api/v1/portal`, alongside every other portal router. */
export function createPortalLoanSigningRouter(deps: PortalLoanSigningControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalLoanSigningController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.get('/signing-sessions', requirePortalAuth, controller.listSessions);
  router.get('/signing-sessions/:sessionId', requirePortalAuth, controller.getSession);
  router.post('/signing-sessions/:sessionId/request-otp', requirePortalAuth, controller.requestOtp);
  router.post('/signing-sessions/:sessionId/verify-otp', requirePortalAuth, validateBody(verifySigningOtpSchema), controller.verifyOtp);
  router.get('/signing-sessions/:sessionId/documents/:documentId/file', requirePortalAuth, controller.getDocumentFile);
  router.post(
    '/signing-sessions/:sessionId/documents/:documentId/sign',
    requirePortalAuth,
    validateBody(signLoanSigningDocumentSchema),
    controller.signDocument,
  );

  return router;
}
