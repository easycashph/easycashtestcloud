import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { LoanSigningController, type LoanSigningControllerDeps } from './loanSigningController';
import { SigningNotificationLogController, type SigningNotificationLogControllerDeps } from './signingNotificationLogController';
import { createLoanSigningSessionSchema } from './loanSigningSchemas';

/** Staff-side (authenticated) routes. No role restriction beyond authentication - same access
 * level as `loanDocumentRouter`'s own routes (ADR-051 §5: any staff working a loan account can
 * generate/view its documents; sending them for signature is the same class of action). */
export function createLoanSigningRouter(
  deps: LoanSigningControllerDeps & SigningNotificationLogControllerDeps,
  tokenService: ITokenService,
): Router {
  const router = Router();
  const controller = new LoanSigningController(deps);
  const notificationLogController = new SigningNotificationLogController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post(
    '/loan-accounts/:loanAccountId/signing-sessions',
    requireAuth,
    validateBody(createLoanSigningSessionSchema),
    controller.create,
  );
  router.get('/loan-accounts/:loanAccountId/signing-sessions', requireAuth, controller.list);
  router.get(
    '/loan-accounts/:loanAccountId/signing-sessions/:sessionId/documents/:documentId/file',
    requireAuth,
    controller.getDocumentFile,
  );

  // 2026-07-29 (user request): centralized, cross-loan record of every signing-link and OTP send
  // (SMS or Email) - branch-scoped like every other read-only log endpoint, any authenticated
  // role may view (see SigningNotificationLog's own doc comment for why this exists).
  router.get('/signing-notification-logs', requireAuth, notificationLogController.list);

  return router;
}
