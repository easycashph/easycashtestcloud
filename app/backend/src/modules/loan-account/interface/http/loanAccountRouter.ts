import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { LoanAccountController, type LoanAccountControllerDeps } from './loanAccountController';
import { createLoanAccountSchema, rejectLoanSchema } from './loanAccountSchemas';

/**
 * ADR-043 / D-1: interim role gates, not sourced from a documented
 * PROJECT_RULES.md rule. Origination (creating a loan account) uses the
 * same roles as borrower/co-borrower creation. Approval/rejection is
 * restricted more tightly (Administrator/Manager only, excluding Loan
 * Officer) — a common lending separation-of-duties assumption (the
 * originator typically shouldn't also approve), not a verified business
 * rule; flagged here for confirmation.
 */
const ORIGINATION_ROLES = ['Administrator', 'Manager', 'Loan Officer'];
const APPROVAL_ROLES = ['Administrator', 'Manager'];

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
