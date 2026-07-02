import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { BorrowerController, type BorrowerControllerDeps } from './borrowerController';
import { createBorrowerSchema, createCoBorrowerSchema } from './borrowerSchemas';

/**
 * ADR-043 / D-1: interim role gate — origination staff only for writes,
 * any authenticated role for reads (Viewer's whole purpose is read access).
 * No PROJECT_RULES.md rule specifies exactly which roles may create a
 * borrower; this is a reasonable, documented interim assumption, not a
 * verified business rule.
 */
const ORIGINATION_ROLES = ['Administrator', 'Manager', 'Loan Officer'];

export function createBorrowerRouter(deps: BorrowerControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new BorrowerController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/borrowers', requireAuth, requireRole(...ORIGINATION_ROLES), validateBody(createBorrowerSchema), controller.create);
  router.get('/borrowers/:id', requireAuth, controller.get);
  router.get('/borrowers', requireAuth, controller.list);

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
