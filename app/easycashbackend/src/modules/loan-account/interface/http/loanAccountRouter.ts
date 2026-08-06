import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { LoanAccountController, type LoanAccountControllerDeps } from './loanAccountController';
import {
  adjustLoanSchema,
  createLoanAccountSchema,
  processPaymentSchema,
  rejectLoanSchema,
  restructureLoanSchema,
  reversePaymentSchema,
  updateLoanAccountSchema,
} from './loanAccountSchemas';

/**
 * 2026-08-06: every tier below moved from a hard-coded `requireRole(...)` allow-list to a
 * DB-backed `requirePermission(code)` check (Roles & Permissions feature, ADR-038's deferred full
 * design) — the exact default grants each historical note below describes are now seeded as the
 * starting `RolePermission` rows for that code (see `prisma/seed.ts`), configurable by MIS from
 * there on without a code change. The comments are kept for their historical "why this tier"
 * rationale, which the seed's own defaults still honor; they no longer describe a fixed gate.
 *
 * ADR-038 §3.1 origination tier (business-confirmed, 2026-07-06): MIS, Loan Operation Manager,
 * CRM by default — mirrors the confirmed Loan-Application assign access.
 *
 * Approval is a NARROWER, separate tier (corrected 2026-07-21, business clarification): only
 * MIS and Loan Operation Manager by default — CRM's role in the pipeline stops at Tag Pre
 * Approval on the Loan Application; the Manager gives a distinct, later approval on the created
 * account.
 *
 * Activation/disbursement is a distinct tier from approval — MIS, Loan Operation Manager, and
 * Accounting (the function that actually releases funds) by default.
 *
 * Payment recording (ADR-038 §3.6) is a different tier from origination/approval/activation — a
 * financial-recording/collections function. MIS, Loan Operation Manager, Accounting, Collection
 * Officer by default.
 *
 * Restructure/Adjust (2026-07-24, user-confirmed): MIS and Accounting only by default — bigger
 * financial actions than Adjust Penalty/Adjust Fees.
 */
export function createLoanAccountRouter(deps: LoanAccountControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanAccountController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post(
    '/loan-accounts',
    requireAuth,
    requirePermission('loan_account.originate'),
    validateBody(createLoanAccountSchema),
    controller.create,
  );
  // 2026-07-16 (Edit Loan Account, user request): same tier as origination — the same real-world
  // job function that created the loan account is who'd fix a typo'd term/amount on it.
  router.patch(
    '/loan-accounts/:id',
    requireAuth,
    requirePermission('loan_account.originate'),
    validateBody(updateLoanAccountSchema),
    controller.update,
  );
  router.get('/loan-accounts/:id', requireAuth, controller.get);
  router.get('/loan-accounts/:id/risk-assessment', requireAuth, controller.riskAssessment);
  router.get('/loan-accounts', requireAuth, controller.list);

  router.post('/loan-accounts/:id/approve', requireAuth, requirePermission('loan_account.approve'), controller.approve);
  // 2026-07-16 (Undo Approve / Undo Activate, user request): a narrower, MIS-only-by-default
  // safety net for an accidental click on a financially consequential action — same reasoning as
  // Reverse Payment below.
  router.post('/loan-accounts/:id/undo-approve', requireAuth, requirePermission('loan_account.undo_approve'), controller.undoApprove);
  router.post(
    '/loan-accounts/:id/reject',
    requireAuth,
    requirePermission('loan_account.approve'),
    validateBody(rejectLoanSchema),
    controller.reject,
  );

  router.post('/loan-accounts/:id/activate', requireAuth, requirePermission('loan_account.activate'), controller.activate);
  router.post('/loan-accounts/:id/undo-activate', requireAuth, requirePermission('loan_account.undo_activate'), controller.undoActivate);
  router.post(
    '/loan-accounts/:id/payments',
    requireAuth,
    requirePermission('payment.record'),
    validateBody(processPaymentSchema),
    controller.processPayment,
  );
  // 2026-07-11 (Reverse Payment feature, user decision): a narrower, MIS-only-by-default safety
  // net than payment recording itself — same "accidental-click safety net for a financially
  // consequential action" reasoning as loan-application's revert-decision route above.
  router.post(
    '/loan-accounts/:id/transactions/:transactionId/reverse',
    requireAuth,
    requirePermission('payment.reverse'),
    validateBody(reversePaymentSchema),
    controller.reversePayment,
  );

  // 2026-07-24 (Loan Restructure feature, user-confirmed): offered only for a past-due/matured
  // ACTIVE/ACTIVE_IN_ARREARS loan, exactly once - eligibility enforced by RestructureLoanUseCase,
  // not this router.
  router.post(
    '/loan-accounts/:id/restructure',
    requireAuth,
    requirePermission('loan_account.restructure'),
    validateBody(restructureLoanSchema),
    controller.restructure,
  );
  router.get('/loan-accounts/:id/restructure', requireAuth, controller.getRestructure);
  router.get('/loan-accounts/:id/accrued-interest', requireAuth, controller.accruedInterest);

  // 2026-07-24 (Loan Adjustment feature, user-confirmed): offered only for a zero-payment ACTIVE
  // loan before its first installment's due date, exactly once - eligibility enforced by
  // AdjustLoanUseCase, not this router.
  router.post(
    '/loan-accounts/:id/adjust',
    requireAuth,
    requirePermission('loan_account.adjust'),
    validateBody(adjustLoanSchema),
    controller.adjust,
  );
  router.get('/loan-accounts/:id/adjust', requireAuth, controller.getAdjustment);

  return router;
}
