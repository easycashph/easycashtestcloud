import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { DashboardController, type DashboardControllerDeps } from './dashboardController';

/** Read-only. Every authenticated role may view the dashboard — branch scoping (not role
 * gating) is what restricts a non-MIS user to their own branch's figures. */
export function createDashboardRouter(deps: DashboardControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new DashboardController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/dashboard/summary', requireAuth, controller.getSummary);

  return router;
}
