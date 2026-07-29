import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { SmsReminderLogController, type SmsReminderLogControllerDeps } from './smsReminderLogController';

/** Read-only. Every authenticated role may view logs - branch scoping (not role gating) restricts a non-MIS user to their own branch, mirroring the dashboard/payment-reminder modules. */
export function createSmsReminderLogRouter(deps: SmsReminderLogControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new SmsReminderLogController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/sms-reminder-logs', requireAuth, controller.list);

  return router;
}
