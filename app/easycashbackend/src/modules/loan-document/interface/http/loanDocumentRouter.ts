import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { requireRole } from '@shared/middleware/requireRole';
import { LoanDocumentController, type LoanDocumentControllerDeps } from './loanDocumentController';
import { generateLoanDocumentSchema } from './loanDocumentSchemas';

/**
 * 2026-08-06: generating a document is now gated by `document.generate` (Roles & Permissions
 * feature) — previously no role restriction at all beyond authentication (ADR-051 §5: "any staff
 * working a loan account can generate/view/download its documents"). Default grant is every role
 * (preserving that decision), configurable by MIS from there — this was the concrete example that
 * motivated the feature (a role that should NOT be able to generate documents). Viewing/
 * downloading an already-generated document remains open to any authenticated role, unchanged —
 * only the act of generating a new one is gated.
 */
export function createLoanDocumentRouter(deps: LoanDocumentControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanDocumentController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post(
    '/loan-accounts/:id/documents',
    requireAuth,
    requirePermission('document.generate'),
    validateBody(generateLoanDocumentSchema),
    controller.generate,
  );
  router.get('/loan-accounts/:id/documents', requireAuth, controller.list);
  router.get('/loan-accounts/:id/documents/:generatedDocumentId/download', requireAuth, controller.download);

  // 2026-08-20 (user request): MIS-only bulk export - every attachment, generated document, and
  // signed document for one loan account as a single organized ZIP. `requireRole('MIS')` rather
  // than `requirePermission`, matching every other hard-restricted-to-MIS route in this codebase.
  router.get('/loan-accounts/:id/documents/download-all', requireAuth, requireRole('MIS'), controller.downloadAll);

  return router;
}
