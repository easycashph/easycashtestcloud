import { Router } from 'express';
import { SmsReminderDlrController, type SmsReminderDlrControllerDeps } from './smsReminderDlrController';

/** No requireAuth - M360's servers call this directly (see controller's own doc comment for how it's secured instead). */
export function createSmsReminderDlrRouter(deps: SmsReminderDlrControllerDeps): Router {
  const router = Router();
  const controller = new SmsReminderDlrController(deps);

  router.get('/sms-reminders/dlr', controller.receive);

  return router;
}
