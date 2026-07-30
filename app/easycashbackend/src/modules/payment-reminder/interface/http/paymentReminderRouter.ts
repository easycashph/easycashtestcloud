import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { PaymentReminderController, type PaymentReminderControllerDeps } from './paymentReminderController';

/** Read-only. Every authenticated role may view reminders — branch scoping (not role gating) restricts a non-MIS user to their own branch, mirroring the dashboard module. */
export function createPaymentReminderRouter(deps: PaymentReminderControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new PaymentReminderController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/payment-reminders', requireAuth, controller.list);

  return router;
}
