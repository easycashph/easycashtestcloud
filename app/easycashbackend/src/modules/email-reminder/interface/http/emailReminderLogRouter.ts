import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { EmailReminderLogController, type EmailReminderLogControllerDeps } from './emailReminderLogController';

/** Read-only, branch-scoped - mirrors smsReminderLogRouter exactly. */
export function createEmailReminderLogRouter(deps: EmailReminderLogControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new EmailReminderLogController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/email-reminder-logs', requireAuth, controller.list);

  return router;
}
