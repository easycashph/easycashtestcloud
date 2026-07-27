import { Router } from 'express';
import { validateBody } from '@shared/middleware/validate';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { createRequirePortalAuth } from './requirePortalAuth';
import { PortalSecurityController, type PortalSecurityControllerDeps } from './portalSecurityController';
import { changePortalPasswordSchema, changePortalEmailSchema } from './portalSecuritySchemas';

/** Portal Security tab (2026-07-27 user request) - self-service email/password change, gated by
 * the current password. Mounted at the same /api/v1/portal prefix as every other portal router. */
export function createPortalSecurityRouter(deps: PortalSecurityControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalSecurityController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.post('/security/change-password', requirePortalAuth, validateBody(changePortalPasswordSchema), controller.changePassword);
  router.patch('/security/email', requirePortalAuth, validateBody(changePortalEmailSchema), controller.changeEmail);

  return router;
}
