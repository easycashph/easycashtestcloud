import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { BorrowerController, type BorrowerControllerDeps } from './borrowerController';
import { createBorrowerSchema, createCoBorrowerSchema, updateBorrowerSchema } from './borrowerSchemas';

/**
 * ADR-038 §3.1 (business-confirmed, 2026-07-06): origination staff only for
 * writes, any authenticated role for reads. Supersedes ADR-043's interim
 * placeholder allow-list.
 */
const ORIGINATION_ROLES = ['MIS', 'Loan Operation Manager', 'CRM'];

export function createBorrowerRouter(deps: BorrowerControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new BorrowerController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/borrowers', requireAuth, requireRole(...ORIGINATION_ROLES), validateBody(createBorrowerSchema), controller.create);
  router.get('/borrowers/:id', requireAuth, controller.get);
  router.get('/borrowers/:id/risk-summary', requireAuth, controller.riskSummary);
  router.get('/borrowers', requireAuth, controller.list);
  router.patch(
    '/borrowers/:id',
    requireAuth,
    requireRole(...ORIGINATION_ROLES),
    validateBody(updateBorrowerSchema),
    controller.update,
  );

  router.post(
    '/co-borrowers',
    requireAuth,
    requireRole(...ORIGINATION_ROLES),
    validateBody(createCoBorrowerSchema),
    controller.createCoBorrower,
  );
  router.get('/co-borrowers/:id', requireAuth, controller.getCoBorrower);

  return router;
}
