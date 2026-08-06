import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { LoanSigningController, type LoanSigningControllerDeps } from './loanSigningController';
import { SigningNotificationLogController, type SigningNotificationLogControllerDeps } from './signingNotificationLogController';
import { createLoanSigningSessionSchema } from './loanSigningSchemas';

/**
 * Staff-side (authenticated) routes. 2026-08-06: sending an e-signature session is now gated by
 * `esignature.manage` (Roles & Permissions feature) — previously no role restriction beyond
 * authentication, same access level as `loanDocumentRouter`'s own routes (ADR-051 §5). Default
 * grant is every role (preserving that prior decision), configurable by MIS from there — this was
 * one of the concrete examples that motivated the feature. Viewing sessions/documents/logs
 * remains open to any authenticated role, unchanged.
 */
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
    requirePermission('esignature.manage'),
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
