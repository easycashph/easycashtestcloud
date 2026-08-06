import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { validateBody } from '@shared/middleware/validate';
import { RepaymentController, type RepaymentControllerDeps } from './repaymentController';
import { adjustFeesSchema, reducePenaltySchema } from './repaymentSchemas';

/**
 * Mostly D-2 (read-only) — CreateRepaymentInstallmentUseCase and RecordInstallmentPaymentUseCase
 * still have no route. `reduce-penalty`/`adjust-fees` below are the deliberate write exceptions
 * (2026-07-15/16, user-confirmed business rules).
 *
 * 2026-08-06: both moved from a hard-coded `requireRole(...)` allow-list to a DB-backed
 * `requirePermission` check (Roles & Permissions feature). Default grant for both (2026-07-15/16,
 * user-confirmed): "the accounting officer" — the seeded `Accounting` role, plus MIS.
 */

export function createRepaymentRouter(deps: RepaymentControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new RepaymentController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/loan-accounts/:loanAccountId/repayment-schedule', requireAuth, controller.listForLoan);
  router.get('/loan-accounts/:loanAccountId/installment-adjustments', requireAuth, controller.listInstallmentAdjustmentsForLoan);
  router.get('/repayment-installments/:id', requireAuth, controller.get);
  router.post(
    '/repayment-installments/:id/reduce-penalty',
    requireAuth,
    requirePermission('penalty.reduce'),
    validateBody(reducePenaltySchema),
    controller.reducePenalty,
  );
  router.post(
    '/repayment-installments/:id/adjust-fees',
    requireAuth,
    requirePermission('fees.adjust'),
    validateBody(adjustFeesSchema),
    controller.adjustFees,
  );

  return router;
}
