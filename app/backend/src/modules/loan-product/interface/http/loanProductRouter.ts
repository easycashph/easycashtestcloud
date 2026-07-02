import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { LoanProductController, type LoanProductControllerDeps } from './loanProductController';
import { createLoanProductSchema, createLoanProductVersionSchema } from './loanProductSchemas';

/**
 * ADR-043 / D-1: interim role gate. Product configuration (create
 * product/version, activate a version) is more sensitive than borrower
 * origination — restricted to Administrator/Manager only, not Loan
 * Officer. Not sourced from a documented PROJECT_RULES.md rule; a
 * reasonable interim assumption.
 */
const PRODUCT_CONFIG_ROLES = ['Administrator', 'Manager'];

export function createLoanProductRouter(deps: LoanProductControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanProductController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post(
    '/loan-products',
    requireAuth,
    requireRole(...PRODUCT_CONFIG_ROLES),
    validateBody(createLoanProductSchema),
    controller.create,
  );
  router.get('/loan-products/:id', requireAuth, controller.get);
  router.get('/loan-products', requireAuth, controller.list);

  router.post(
    '/loan-products/:id/versions',
    requireAuth,
    requireRole(...PRODUCT_CONFIG_ROLES),
    validateBody(createLoanProductVersionSchema),
    controller.createVersion,
  );
  router.post(
    '/loan-products/:id/versions/:versionId/activate',
    requireAuth,
    requireRole(...PRODUCT_CONFIG_ROLES),
    controller.activateVersion,
  );

  return router;
}
