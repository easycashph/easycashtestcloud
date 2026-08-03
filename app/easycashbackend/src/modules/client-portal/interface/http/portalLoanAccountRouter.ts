import { Router } from 'express';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { createRequirePortalAuth } from './requirePortalAuth';
import { PortalLoanAccountController, type PortalLoanAccountControllerDeps } from './portalLoanAccountController';

/** Payment history / amortization schedule for a linked client's real, booked loan account(s)
 * (2026-07-31 user request). Mounted at the same /api/v1/portal prefix as every other portal
 * router. */
export function createPortalLoanAccountRouter(deps: PortalLoanAccountControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalLoanAccountController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.get('/loan-accounts', requirePortalAuth, controller.list);
  router.get('/loan-accounts/:id/installments', requirePortalAuth, controller.listInstallments);

  return router;
}
