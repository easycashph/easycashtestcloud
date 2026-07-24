import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { LoanAccountController, type LoanAccountControllerDeps } from './loanAccountController';
import {
  createLoanAccountSchema,
  processPaymentSchema,
  rejectLoanSchema,
  restructureLoanSchema,
  reversePaymentSchema,
  updateLoanAccountSchema,
} from './loanAccountSchemas';

/**
 * ADR-038 §3.1 origination tier (business-confirmed, 2026-07-06): MIS, Loan Operation Manager,
 * CRM — mirrors the confirmed Loan-Application assign access.
 *
 * Approval is a NARROWER, separate tier (corrected 2026-07-21, business clarification): only
 * MIS and Loan Operation Manager may approve a Loan Account — CRM's role in the pipeline stops
 * at Tag Pre Approval on the Loan Application; the Manager gives a distinct, later approval on
 * the created account. This reinstates the separation-of-duties ADR-038 §3.1's original note
 * described as "never confirmed by the business" — it has now been confirmed, for approval only
 * (origination and activation are unaffected).
 */
const ORIGINATION_ROLES = ['MIS', 'Loan Operation Manager', 'CRM'];
const APPROVAL_ROLES = ['MIS', 'Loan Operation Manager'];

/**
 * Corrected 2026-07-21 (business clarification): activation/disbursement is a distinct tier from
 * approval — MIS, Loan Operation Manager, and Accounting (the function that actually releases
 * funds) may activate a Loan Account. Drops CRM, which has no role past Tag Pre Approval/Approve.
 * Supersedes the 2026-07-06 note that activation mirrored approval's tier exactly.
 */
const ACTIVATION_ROLES = ['MIS', 'Loan Operation Manager', 'Accounting'];

/**
 * ADR-038 §3.6: payment recording is a different tier from origination/
 * approval/activation — a financial-recording/collections function, not a
 * loan-processing one. Drops CRM, adds Accounting and Collection Officer.
 * Deliberately excludes Finance — noted by the business as "configurable
 * depending on MIS policy," not a permanent exclusion, but the current
 * binding allow-list per that ADR section.
 */
const PAYMENT_RECORDING_ROLES = ['MIS', 'Loan Operation Manager', 'Accounting', 'Collection Officer'];

/**
 * 2026-07-24 (Loan Restructure feature, user-confirmed): same tier as Adjust Penalty/Adjust Fees
 * — MIS and Accounting only. A bigger financial action than either of those (creates a whole new
 * LoanAccount, closes the old one), so deliberately not widened to any other tier.
 */
const RESTRUCTURE_ROLES = ['MIS', 'Accounting'];

export function createLoanAccountRouter(deps: LoanAccountControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanAccountController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post(
    '/loan-accounts',
    requireAuth,
    requireRole(...ORIGINATION_ROLES),
    validateBody(createLoanAccountSchema),
    controller.create,
  );
  // 2026-07-16 (Edit Loan Account, user request): same tier as origination — the same real-world
  // job function that created the loan account is who'd fix a typo'd term/amount on it.
  router.patch(
    '/loan-accounts/:id',
    requireAuth,
    requireRole(...ORIGINATION_ROLES),
    validateBody(updateLoanAccountSchema),
    controller.update,
  );
  router.get('/loan-accounts/:id', requireAuth, controller.get);
  router.get('/loan-accounts/:id/risk-assessment', requireAuth, controller.riskAssessment);
  router.get('/loan-accounts', requireAuth, controller.list);

  router.post('/loan-accounts/:id/approve', requireAuth, requireRole(...APPROVAL_ROLES), controller.approve);
  // 2026-07-16 (Undo Approve / Undo Activate, user request): MIS only — narrower than approval/
  // activation themselves, same "accidental-click safety net for a financially consequential
  // action" reasoning as Reverse Payment below. Not open to the full APPROVAL_ROLES/
  // ACTIVATION_ROLES tier per explicit user instruction.
  router.post('/loan-accounts/:id/undo-approve', requireAuth, requireRole('MIS'), controller.undoApprove);
  router.post(
    '/loan-accounts/:id/reject',
    requireAuth,
    requireRole(...APPROVAL_ROLES),
    validateBody(rejectLoanSchema),
    controller.reject,
  );

  router.post('/loan-accounts/:id/activate', requireAuth, requireRole(...ACTIVATION_ROLES), controller.activate);
  router.post('/loan-accounts/:id/undo-activate', requireAuth, requireRole('MIS'), controller.undoActivate);
  router.post(
    '/loan-accounts/:id/payments',
    requireAuth,
    requireRole(...PAYMENT_RECORDING_ROLES),
    validateBody(processPaymentSchema),
    controller.processPayment,
  );
  // 2026-07-11 (Reverse Payment feature, user decision): MIS only — a narrower gate than payment
  // recording itself, same "accidental-click safety net for a financially consequential action"
  // reasoning as loan-application's revert-decision route above.
  router.post(
    '/loan-accounts/:id/transactions/:transactionId/reverse',
    requireAuth,
    requireRole('MIS'),
    validateBody(reversePaymentSchema),
    controller.reversePayment,
  );

  // 2026-07-24 (Loan Restructure feature, user-confirmed): offered only for a past-due/matured
  // ACTIVE/ACTIVE_IN_ARREARS loan, exactly once - eligibility enforced by RestructureLoanUseCase,
  // not this router.
  router.post(
    '/loan-accounts/:id/restructure',
    requireAuth,
    requireRole(...RESTRUCTURE_ROLES),
    validateBody(restructureLoanSchema),
    controller.restructure,
  );
  router.get('/loan-accounts/:id/restructure', requireAuth, controller.getRestructure);
  router.get('/loan-accounts/:id/accrued-interest', requireAuth, controller.accruedInterest);

  return router;
}
