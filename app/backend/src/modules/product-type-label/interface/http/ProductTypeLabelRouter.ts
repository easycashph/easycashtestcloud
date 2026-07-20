import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { validateBody } from '@shared/middleware/validate';
import type { ProductTypeLabelController } from './ProductTypeLabelController';
import { updateProductTypeLabelSchema } from './productTypeLabelSchemas';

/** View for every authenticated role (used to render the Loan Products catalog and pickers), rename MIS-only. */
export function createProductTypeLabelRouter(controller: ProductTypeLabelController, tokenService: ITokenService): Router {
  const router = Router();
  const requireAuth = createRequireAuth(tokenService);
  const requireMis = requireRole('MIS');

  router.get('/product-type-labels', requireAuth, controller.list);
  router.patch('/product-type-labels/:id', requireAuth, requireMis, validateBody(updateProductTypeLabelSchema), controller.update);

  return router;
}
