import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { validateBody } from '@shared/middleware/validate';
import { NegativeAreaController, type NegativeAreaControllerDeps } from './negativeAreaController';
import { createNegativeAreaSchema } from './negativeAreaSchemas';

/**
 * 2026-09-15 (Negative Areas admin config, user request): lets MIS maintain the high-risk address
 * list that feeds LoanApplicationPreQualificationService's advisory Negative Area check, without a
 * developer editing code each time. Gated by `negative_area.manage` - MIS-only by default, same
 * posture as `document_template.manage`.
 */
export function createNegativeAreaRouter(deps: NegativeAreaControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new NegativeAreaController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const canManage = requirePermission('negative_area.manage');

  router.get('/negative-areas', requireAuth, canManage, controller.list);
  router.post('/negative-areas', requireAuth, canManage, validateBody(createNegativeAreaSchema), controller.create);
  router.delete('/negative-areas/:id', requireAuth, canManage, controller.remove);

  return router;
}
