import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { ReportingController, type ReportingControllerDeps } from './reportingController';

/** Read-only. Every authenticated role may view reports — branch scoping (not role gating) restricts a non-MIS user to their own branch, mirroring the dashboard module. */
export function createReportingRouter(deps: ReportingControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new ReportingController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/reports/loan-origination', requireAuth, controller.loanOrigination);
  router.get('/reports/collections', requireAuth, controller.collections);
  router.get('/reports/transactions', requireAuth, controller.transactions);

  return router;
}
