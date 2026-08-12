import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { PaymentReminderController, type PaymentReminderControllerDeps } from './paymentReminderController';

/** Read-only. 2026-08-06: gated by `collection.view_past_due` (Roles & Permissions feature) —
 * previously every authenticated role could view, unconditionally. Default grant is every role
 * (preserving that behavior), configurable by MIS from there. Branch scoping (separate from role
 * gating) still restricts a non-MIS user to their own branch, mirroring the dashboard module. */
export function createPaymentReminderRouter(deps: PaymentReminderControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new PaymentReminderController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/payment-reminders', requireAuth, requirePermission('collection.view_past_due'), controller.list);

  return router;
}
