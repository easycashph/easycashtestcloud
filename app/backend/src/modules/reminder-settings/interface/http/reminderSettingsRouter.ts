import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { ReminderSettingsController, type ReminderSettingsControllerDeps } from './reminderSettingsController';

/** MIS-only, both routes (user's explicit request 2026-07-18: "MIS lang muna ang may access nito"). */
export function createReminderSettingsRouter(deps: ReminderSettingsControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new ReminderSettingsController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const misOnly = requireRole('MIS');

  router.get('/reminder-settings', requireAuth, misOnly, controller.get);
  router.patch('/reminder-settings', requireAuth, misOnly, controller.update);

  return router;
}
