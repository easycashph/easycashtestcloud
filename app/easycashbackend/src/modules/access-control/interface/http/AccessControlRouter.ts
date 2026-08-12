import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { validateBody } from '@shared/middleware/validate';
import type { AccessControlController } from './AccessControlController';
import { updateRolePermissionsSchema } from './accessControlSchemas';

/** MIS-only, both routes — this screen configures every OTHER role's access, so only the
 * super-user role (ADR-038 §1/§3.2) may view or change it. */
export function createAccessControlRouter(controller: AccessControlController, tokenService: ITokenService): Router {
  const router = Router();
  const requireAuth = createRequireAuth(tokenService);
  const misOnly = requireRole('MIS');

  router.get('/roles-permissions', requireAuth, misOnly, controller.list);
  router.patch(
    '/roles/:roleId/permissions',
    requireAuth,
    misOnly,
    validateBody(updateRolePermissionsSchema),
    controller.updateRolePermissions,
  );

  return router;
}
