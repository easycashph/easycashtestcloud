import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { LoanProductController, type LoanProductControllerDeps } from './loanProductController';
import { createLoanProductSchema, createLoanProductVersionSchema } from './loanProductSchemas';

/**
 * 2026-08-06: `loan_product.write` moved from a hard-coded `requireRole(...)` allow-list to a
 * DB-backed `requirePermission` check (Roles & Permissions feature). Default grant (ADR-038 §3.1,
 * business-confirmed 2026-07-06): product configuration (create product/version, activate a
 * version) is a Finance/Accounting responsibility, not a loan-processing one — a wider tier than
 * origination (adds Finance, Accounting) but deliberately excludes CRM (which IS included in
 * origination).
 */

export function createLoanProductRouter(deps: LoanProductControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanProductController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post(
    '/loan-products',
    requireAuth,
    requirePermission('loan_product.write'),
    validateBody(createLoanProductSchema),
    controller.create,
  );
  router.get('/loan-products/:id', requireAuth, controller.get);
  router.get('/loan-products', requireAuth, controller.list);

  router.post(
    '/loan-products/:id/versions',
    requireAuth,
    requirePermission('loan_product.write'),
    validateBody(createLoanProductVersionSchema),
    controller.createVersion,
  );
  router.post(
    '/loan-products/:id/versions/:versionId/activate',
    requireAuth,
    requirePermission('loan_product.write'),
    controller.activateVersion,
  );

  return router;
}
