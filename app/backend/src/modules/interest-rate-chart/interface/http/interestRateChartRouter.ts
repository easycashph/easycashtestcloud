import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { InterestRateChartController, type InterestRateChartControllerDeps } from './interestRateChartController';

/** Read-only. Every authenticated role may view the chart — needed by anyone using Create Loan Account. */
export function createInterestRateChartRouter(deps: InterestRateChartControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new InterestRateChartController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/interest-rate-chart', requireAuth, controller.list);

  return router;
}
