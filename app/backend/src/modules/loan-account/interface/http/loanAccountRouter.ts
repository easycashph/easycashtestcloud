import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { LoanAccountController, type LoanAccountControllerDeps } from './loanAccountController';
import { createLoanAccountSchema, rejectLoanSchema } from './loanAccountSchemas';

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
  router.get('/loan-accounts', requireAuth, controller.list);

  router.post('/loan-accounts/:id/approve', requireAuth, requireRole(...APPROVAL_ROLES), controller.approve);
  router.post(
    '/loan-accounts/:id/reject',
    requireAuth,
    requireRole(...APPROVAL_ROLES),
    validateBody(rejectLoanSchema),
    controller.reject,
  );

  return router;
}
