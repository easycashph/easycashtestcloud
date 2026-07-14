import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { UserController, type UserControllerDeps } from './userController';
import { changeOwnPasswordSchema, createUserSchema, updateOwnProfileSchema, updateUserSchema } from './userSchemas';

export function createUserRouter(deps: UserControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new UserController(deps);
  const requireAuth = createRequireAuth(tokenService);
  // Mirrors the mock UI's canManageMembers — MIS only.
  const requireMemberManagement = requireRole('MIS');

  // Every authenticated role may view the staff roster (matches the mock UI: Member Details has
  // no page-level access restriction, only the Add/Edit actions are MIS-gated).
  router.get('/users', requireAuth, controller.list);
  router.post('/users', requireAuth, requireMemberManagement, validateBody(createUserSchema), controller.create);

  // Self-service routes - every authenticated user may act on their own record, no
  // `requireMemberManagement`. Registered before `/users/:id` so "me" is never captured as an id.
  router.patch('/users/me', requireAuth, validateBody(updateOwnProfileSchema), controller.updateOwnProfile);
  router.post('/users/me/change-password', requireAuth, validateBody(changeOwnPasswordSchema), controller.changeOwnPassword);

  router.patch('/users/:id', requireAuth, requireMemberManagement, validateBody(updateUserSchema), controller.update);

  return router;
}
