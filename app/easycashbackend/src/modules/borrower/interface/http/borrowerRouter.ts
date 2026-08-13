import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { requireRole } from '@shared/middleware/requireRole';
import { BorrowerController, type BorrowerControllerDeps } from './borrowerController';
import { createBorrowerSchema, createCoBorrowerSchema, updateBorrowerSchema, updateCoBorrowerSchema } from './borrowerSchemas';

/**
 * 2026-08-06: `borrower.write` moved from a hard-coded `requireRole(...)` allow-list to a
 * DB-backed `requirePermission` check (Roles & Permissions feature). Default grant (ADR-038 §3.1,
 * business-confirmed 2026-07-06): origination staff (MIS, Loan Operation Manager, CRM) — reads
 * remain open to any authenticated role, unchanged.
 */

export function createBorrowerRouter(deps: BorrowerControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new BorrowerController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/borrowers', requireAuth, requirePermission('borrower.write'), validateBody(createBorrowerSchema), controller.create);
  router.get('/borrowers/:id', requireAuth, controller.get);
  router.get('/borrowers/:id/risk-summary', requireAuth, controller.riskSummary);
  router.get('/borrowers/:id/mitigation', requireAuth, controller.mitigation);
  router.get('/borrowers/:id/co-borrowers', requireAuth, controller.listCoBorrowers);
  // Bind existing Client data to Portal (2026-08-06) - MIS-only, mirrors "Only MIS may
  // add/edit LMS member accounts" (canManageMembers on the frontend): creating/linking a client's
  // portal login is the same class of sensitive account-provisioning action.
  router.get('/borrowers/:id/portal-account', requireAuth, requireRole('MIS'), controller.getPortalAccountStatus);
  router.post('/borrowers/:id/portal-account', requireAuth, requireRole('MIS'), controller.createPortalAccount);
  router.post('/borrowers/:id/portal-account/bind', requireAuth, requireRole('MIS'), controller.bindPortalAccount);
  router.get('/borrowers', requireAuth, controller.list);
  router.patch(
    '/borrowers/:id',
    requireAuth,
    requirePermission('borrower.write'),
    validateBody(updateBorrowerSchema),
    controller.update,
  );

  router.post(
    '/co-borrowers',
    requireAuth,
    requirePermission('borrower.write'),
    validateBody(createCoBorrowerSchema),
    controller.createCoBorrower,
  );
  router.get('/co-borrowers/:id', requireAuth, controller.getCoBorrower);
  router.patch(
    '/co-borrowers/:id',
    requireAuth,
    requirePermission('borrower.write'),
    validateBody(updateCoBorrowerSchema),
    controller.updateCoBorrower,
  );

  return router;
}
