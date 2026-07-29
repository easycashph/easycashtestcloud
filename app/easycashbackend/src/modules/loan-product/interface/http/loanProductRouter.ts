import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { LoanProductController, type LoanProductControllerDeps } from './loanProductController';
import { createLoanProductSchema, createLoanProductVersionSchema } from './loanProductSchemas';

/**
 * ADR-038 §3.1 (business-confirmed, 2026-07-06): product configuration
 * (create product/version, activate a version) is a Finance/Accounting
 * responsibility, not a loan-processing one — a wider tier than
 * origination (adds Finance, Accounting) but deliberately excludes CRM
 * (which IS included in origination). Supersedes ADR-043's interim
 * placeholder allow-list.
 */
const PRODUCT_CONFIG_ROLES = ['MIS', 'Loan Operation Manager', 'Finance', 'Accounting'];

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
