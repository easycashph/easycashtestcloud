import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { ReminderSettingsController, type ReminderSettingsControllerDeps } from './reminderSettingsController';

/** Gated by `reminder_settings.manage` (Roles & Permissions feature), MIS-only by default (user's
 * original explicit request 2026-07-18: "MIS lang muna ang may access nito"). */
export function createReminderSettingsRouter(deps: ReminderSettingsControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new ReminderSettingsController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const misOnly = requirePermission('reminder_settings.manage');

  router.get('/reminder-settings', requireAuth, misOnly, controller.get);
  router.patch('/reminder-settings', requireAuth, misOnly, controller.update);

  return router;
}
