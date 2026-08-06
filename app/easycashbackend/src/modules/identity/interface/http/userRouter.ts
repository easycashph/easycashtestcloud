import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { UserController, type UserControllerDeps } from './userController';
import {
  changeOwnPasswordSchema,
  confirmTwoFactorSetupSchema,
  createUserSchema,
  disableTwoFactorSchema,
  requestTwoFactorSetupSchema,
  updateOwnProfileSchema,
  updateUserSchema,
} from './userSchemas';

export function createUserRouter(deps: UserControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new UserController(deps);
  const requireAuth = createRequireAuth(tokenService);
  // Mirrors the mock UI's canManageMembers — gated by `user.manage` (Roles & Permissions
  // feature), MIS-only by default.
  const requireMemberManagement = requirePermission('user.manage');

  // Every authenticated role may view the staff roster (matches the mock UI: Member Details has
  // no page-level access restriction, only the Add/Edit actions are MIS-gated).
  router.get('/users', requireAuth, controller.list);
  router.post('/users', requireAuth, requireMemberManagement, validateBody(createUserSchema), controller.create);

  // Self-service routes - every authenticated user may act on their own record, no
  // `requireMemberManagement`. Registered before `/users/:id` so "me" is never captured as an id.
  router.patch('/users/me', requireAuth, validateBody(updateOwnProfileSchema), controller.updateOwnProfile);
  router.post('/users/me/change-password', requireAuth, validateBody(changeOwnPasswordSchema), controller.changeOwnPassword);

  // Settings > Security > Two-Factor Authentication (2026-07-22) - self-service only, same as
  // change-password above.
  router.post(
    '/users/me/two-factor/setup',
    requireAuth,
    validateBody(requestTwoFactorSetupSchema),
    controller.requestTwoFactorSetup,
  );
  router.post(
    '/users/me/two-factor/confirm',
    requireAuth,
    validateBody(confirmTwoFactorSetupSchema),
    controller.confirmTwoFactorSetup,
  );
  router.post('/users/me/two-factor/disable', requireAuth, validateBody(disableTwoFactorSchema), controller.disableTwoFactor);

  router.patch('/users/:id', requireAuth, requireMemberManagement, validateBody(updateUserSchema), controller.update);

  return router;
}
