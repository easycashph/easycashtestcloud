import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { validateBody } from '@shared/middleware/validate';
import type { RoleClassController } from './RoleClassController';
import { createRoleClassSchema, updateRoleClassSchema } from './roleClassSchemas';

/** Mirrors the Member Details page's own access level: view for every authenticated role, create/edit MIS-only. */
export function createRoleClassRouter(controller: RoleClassController, tokenService: ITokenService): Router {
  const router = Router();
  const requireAuth = createRequireAuth(tokenService);
  const requireMemberManagement = requireRole('MIS', 'Super Admin');

  router.get('/role-classes', requireAuth, controller.list);
  router.post('/role-classes', requireAuth, requireMemberManagement, validateBody(createRoleClassSchema), controller.create);
  router.patch('/role-classes/:id', requireAuth, requireMemberManagement, validateBody(updateRoleClassSchema), controller.update);
  router.delete('/role-classes/:id', requireAuth, requireMemberManagement, controller.delete);

  return router;
}
