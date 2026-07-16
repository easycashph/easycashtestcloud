import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { LoanApplicationController, type LoanApplicationControllerDeps } from './loanApplicationController';
import {
  assignLoanApplicationProductSchema,
  createLoanApplicationSchema,
  decideLoanApplicationSchema,
  reviewReportSchema,
  updateLoanApplicationSchema,
} from './loanApplicationSchemas';

/** Mirrors the mock UI's `canAccessLoanApplications` — MIS, Loan Operation Manager, and CRM only. */
const APPLICATION_ACCESS_ROLES = ['MIS', 'Loan Operation Manager', 'CRM'];
/** 2026-07-17 (Milestone C, Under Review / Pre Approval stages): the FINAL Approve is Manager-level
 * only, excluding CRM - CRM's role in the pipeline stops at Start Review / Review Report / Tag Pre
 * Approval. Mirrors the existing `/revert` route's narrower `requireRole(...)` pattern below. */
const FINAL_APPROVAL_ROLES = ['MIS', 'Loan Operation Manager'];

export function createLoanApplicationRouter(deps: LoanApplicationControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanApplicationController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const requireApplicationAccess = requireRole(...APPLICATION_ACCESS_ROLES);

  router.post('/loan-applications', requireAuth, requireApplicationAccess, validateBody(createLoanApplicationSchema), controller.create);
  router.get('/loan-applications/:id', requireAuth, requireApplicationAccess, controller.get);
  router.patch(
    '/loan-applications/:id',
    requireAuth,
    requireApplicationAccess,
    validateBody(updateLoanApplicationSchema),
    controller.update,
  );
  router.get('/loan-applications', requireAuth, requireApplicationAccess, controller.list);
  router.post(
    '/loan-applications/:id/assign-product',
    requireAuth,
    requireApplicationAccess,
    validateBody(assignLoanApplicationProductSchema),
    controller.assignProduct,
  );
  // 2026-07-16 (Under Review / Pre Approval stages, Milestone B) — CRM/MIS/Loan Operation Manager
  // can Start Review, save the Review Report, and Tag Pre Approval. `/approve` is left on the
  // same shared access-role gate for now (unchanged from before this feature); Milestone C is the
  // one that narrows it to MIS + Loan Operation Manager only, once this path is fully wired up.
  router.post('/loan-applications/:id/start-review', requireAuth, requireApplicationAccess, controller.startReview);
  router.patch(
    '/loan-applications/:id/review-report',
    requireAuth,
    requireApplicationAccess,
    validateBody(reviewReportSchema),
    controller.submitReviewReport,
  );
  router.post('/loan-applications/:id/tag-pre-approval', requireAuth, requireApplicationAccess, controller.tagPreApproval);
  router.post(
    '/loan-applications/:id/approve',
    requireAuth,
    requireRole(...FINAL_APPROVAL_ROLES),
    validateBody(decideLoanApplicationSchema),
    controller.approve,
  );
  router.post(
    '/loan-applications/:id/decline',
    requireAuth,
    requireApplicationAccess,
    validateBody(decideLoanApplicationSchema),
    controller.decline,
  );
  // Mirrors the mock UI's canRevertLoanApplicationDecision — MIS only, a narrower gate than the rest of this router.
  router.post('/loan-applications/:id/revert', requireAuth, requireRole('MIS'), controller.revert);

  return router;
}
