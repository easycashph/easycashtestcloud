import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { SecuritySettingsController, type SecuritySettingsControllerDeps } from './securitySettingsController';

/** Gated by `two_factor_enforcement.manage` (Roles & Permissions feature), MIS-only by default -
 * matches createReminderSettingsRouter's own convention. */
export function createSecuritySettingsRouter(deps: SecuritySettingsControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new SecuritySettingsController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const misOnly = requirePermission('two_factor_enforcement.manage');

  router.get('/security-settings', requireAuth, misOnly, controller.get);
  router.patch('/security-settings', requireAuth, misOnly, controller.update);

  return router;
}
