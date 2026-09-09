import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { LoanApplicationController, type LoanApplicationControllerDeps } from './loanApplicationController';
import {
  assignLoanApplicationProductSchema,
  createLoanApplicationSchema,
  decideLoanApplicationSchema,
  reviewReportSchema,
  setMitigationAccountOwnerSchema,
  setMitigationDetailsSchema,
  updateLoanApplicationSchema,
  updateLoanApplicationIntakeSchema,
} from './loanApplicationSchemas';

/**
 * 2026-08-06: moved from hard-coded `requireRole(...)` allow-lists to DB-backed
 * `requirePermission` checks (Roles & Permissions feature). Default grants:
 * `loan_application.manage` mirrors the mock UI's `canAccessLoanApplications` — MIS, Loan
 * Operation Manager, and CRM. `loan_application.final_approve` (2026-07-17, Milestone C): the
 * FINAL Approve is Manager-level only, excluding CRM - CRM's role in the pipeline stops at Start
 * Review / Review Report / Tag Pre Approval.
 */

export function createLoanApplicationRouter(deps: LoanApplicationControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanApplicationController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const requireApplicationAccess = requirePermission('loan_application.manage');
  // 2026-09-09 (user request): split out of requireApplicationAccess above - lets MIS
  // grant/restrict the AI-assisted document review panel independently of general Loan
  // Application access.
  const requireAiReviewAccess = requirePermission('loan_application.ai_review');

  router.post('/loan-applications', requireAuth, requireApplicationAccess, validateBody(createLoanApplicationSchema), controller.create);
  router.get('/loan-applications/:id', requireAuth, requireApplicationAccess, controller.get);
  router.patch(
    '/loan-applications/:id',
    requireAuth,
    requireApplicationAccess,
    validateBody(updateLoanApplicationSchema),
    controller.update,
  );
  // 2026-08-12 (user request/bug fix): full intake-field edit for staff-encoded applications, up
  // through UNDER_REVIEW - separate from the narrow 3-field `update` above. See
  // UpdateLoanApplicationIntakeUseCase's doc comment.
  router.patch(
    '/loan-applications/:id/intake',
    requireAuth,
    requireApplicationAccess,
    validateBody(updateLoanApplicationIntakeSchema),
    controller.updateIntake,
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
  // 2026-09-09 (user request): "Undo" back to UNDER_REVIEW - same access gate as tagging it in the
  // first place.
  router.post('/loan-applications/:id/undo-pre-approval', requireAuth, requireApplicationAccess, controller.undoPreApproval);
  // 2026-07-29: deliberately NOT status-gated (unlike /review-report above) - see
  // SetMitigationAccountOwnerUseCase's doc comment.
  router.patch(
    '/loan-applications/:id/mitigation-account-owner',
    requireAuth,
    requireApplicationAccess,
    validateBody(setMitigationAccountOwnerSchema),
    controller.setMitigationAccountOwner,
  );
  // 2026-08-10: generalizes the endpoint above to every mitigation field - see
  // SetMitigationDetailsUseCase's doc comment. Same status-unrestricted access gate.
  router.patch(
    '/loan-applications/:id/mitigation-details',
    requireAuth,
    requireApplicationAccess,
    validateBody(setMitigationDetailsSchema),
    controller.setMitigationDetails,
  );
  // 2026-07-22: mocked "Assist" panel above the Credit Evaluation Report - see
  // AiDocumentReviewResult's doc comment. 2026-09-09: gated on its own dedicated permission
  // (loan_application.ai_review) instead of the general requireApplicationAccess, so MIS can
  // control this AI feature independently of Loan Application access.
  router.post('/loan-applications/:id/ai-document-review', requireAuth, requireAiReviewAccess, controller.aiDocumentReview);
  // 2026-08-21 (user request): "Print Application" - saves a generated PDF of the application as
  // an Attachment on it. Same access gate as the rest of this router (not decision-gated - it's
  // available once there's something meaningful to show, see the use case's doc comment).
  router.post('/loan-applications/:id/generate-form', requireAuth, requireApplicationAccess, controller.generateForm);
  // 2026-09-09 (user request): "CRM Report" PDF of the Credit Evaluation Report - same access gate
  // as the review report it's generated from (requireApplicationAccess/loan_application.manage).
  router.post('/loan-applications/:id/crm-report', requireAuth, requireApplicationAccess, controller.generateCrmReport);
  router.post(
    '/loan-applications/:id/approve',
    requireAuth,
    requirePermission('loan_application.final_approve'),
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
  // Mirrors the mock UI's canRevertLoanApplicationDecision — MIS only by default, a narrower gate than the rest of this router.
  router.post('/loan-applications/:id/revert', requireAuth, requirePermission('loan_application.revert'), controller.revert);
  // 2026-08-16 (user request): permanent delete — MIS only. Blocked once the application has
  // already produced a Borrower/LoanAccount, see DeleteLoanApplicationUseCase's doc comment.
  router.delete('/loan-applications/:id', requireAuth, requirePermission('loan_application.delete'), controller.deleteApplication);

  return router;
}
