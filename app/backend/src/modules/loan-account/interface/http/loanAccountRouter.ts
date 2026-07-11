import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { LoanAccountController, type LoanAccountControllerDeps } from './loanAccountController';
import { createLoanAccountSchema, processPaymentSchema, rejectLoanSchema } from './loanAccountSchemas';

/**
 * ADR-038 §3.1 (business-confirmed, 2026-07-06): origination and
 * approval/rejection both use the same tier — MIS, Loan Operation Manager,
 * CRM mirror the confirmed Loan-Application assign/approve/decline access,
 * i.e. the same real-world job function does both. Supersedes ADR-043's
 * interim placeholder allow-lists (which had origination and approval as
 * different tiers under a separation-of-duties assumption never confirmed
 * by the business).
 */
const ORIGINATION_ROLES = ['MIS', 'Loan Operation Manager', 'CRM'];
const APPROVAL_ROLES = ['MIS', 'Loan Operation Manager', 'CRM'];

/**
 * ADR-038 §3.6 (business-confirmed, 2026-07-06, ahead of CP13
 * implementation): activation uses the identical tier as approval — the
 * same real-world job function does both, immediately in sequence.
 */
const ACTIVATION_ROLES = ['MIS', 'Loan Operation Manager', 'CRM'];

/**
 * ADR-038 §3.6: payment recording is a different tier from origination/
 * approval/activation — a financial-recording/collections function, not a
 * loan-processing one. Drops CRM, adds Accounting and Collection Officer.
 * Deliberately excludes Finance — noted by the business as "configurable
 * depending on MIS policy," not a permanent exclusion, but the current
 * binding allow-list per that ADR section.
 */
const PAYMENT_RECORDING_ROLES = ['MIS', 'Loan Operation Manager', 'Accounting', 'Collection Officer'];

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
  router.get('/loan-accounts/:id', requireAuth, controller.get);
  router.get('/loan-accounts/:id/risk-assessment', requireAuth, controller.riskAssessment);
  router.get('/loan-accounts', requireAuth, controller.list);

  router.post('/loan-accounts/:id/approve', requireAuth, requireRole(...APPROVAL_ROLES), controller.approve);
  router.post(
    '/loan-accounts/:id/reject',
    requireAuth,
    requireRole(...APPROVAL_ROLES),
    validateBody(rejectLoanSchema),
    controller.reject,
  );

  router.post('/loan-accounts/:id/activate', requireAuth, requireRole(...ACTIVATION_ROLES), controller.activate);
  router.post(
    '/loan-accounts/:id/payments',
    requireAuth,
    requireRole(...PAYMENT_RECORDING_ROLES),
    validateBody(processPaymentSchema),
    controller.processPayment,
  );

  return router;
}
