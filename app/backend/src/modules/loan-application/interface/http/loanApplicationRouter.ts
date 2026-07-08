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
} from './loanApplicationSchemas';

/** Mirrors the mock UI's `canAccessLoanApplications` — MIS, Loan Operation Manager, and CRM only. */
const APPLICATION_ACCESS_ROLES = ['MIS', 'Loan Operation Manager', 'CRM'];

export function createLoanApplicationRouter(deps: LoanApplicationControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanApplicationController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const requireApplicationAccess = requireRole(...APPLICATION_ACCESS_ROLES);

  router.post('/loan-applications', requireAuth, requireApplicationAccess, validateBody(createLoanApplicationSchema), controller.create);
  router.get('/loan-applications/:id', requireAuth, requireApplicationAccess, controller.get);
  router.get('/loan-applications', requireAuth, requireApplicationAccess, controller.list);
  router.post('/loan-applications/:id/mark-reviewed', requireAuth, requireApplicationAccess, controller.markReviewed);
  router.post(
    '/loan-applications/:id/assign-product',
    requireAuth,
    requireApplicationAccess,
    validateBody(assignLoanApplicationProductSchema),
    controller.assignProduct,
  );
  router.post(
    '/loan-applications/:id/approve',
    requireAuth,
    requireApplicationAccess,
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
