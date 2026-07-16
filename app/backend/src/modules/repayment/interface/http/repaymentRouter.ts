import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { validateBody } from '@shared/middleware/validate';
import { RepaymentController, type RepaymentControllerDeps } from './repaymentController';
import { adjustFeesSchema, reducePenaltySchema } from './repaymentSchemas';

/**
 * Mostly D-2 (read-only) — CreateRepaymentInstallmentUseCase and RecordInstallmentPaymentUseCase
 * still have no route. `reduce-penalty`/`adjust-fees` below are the deliberate write exceptions
 * (2026-07-15/16, user-confirmed business rules).
 */

/**
 * 2026-07-15 (Reduce Penalty feature, user-confirmed): "the accounting officer" — mapped to the
 * seeded `Accounting` role (`prisma/seed.ts`'s job-function roster). MIS included per this
 * codebase's standing convention of MIS being included in every role-gated allow-list.
 */
const REDUCE_PENALTY_ROLES = ['MIS', 'Accounting'];

/** 2026-07-16 (Adjust Fees feature, user-confirmed): same allow-list as Reduce Penalty. */
const ADJUST_FEES_ROLES = ['MIS', 'Accounting'];

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
    requireRole(...REDUCE_PENALTY_ROLES),
    validateBody(reducePenaltySchema),
    controller.reducePenalty,
  );
  router.post(
    '/repayment-installments/:id/adjust-fees',
    requireAuth,
    requireRole(...ADJUST_FEES_ROLES),
    validateBody(adjustFeesSchema),
    controller.adjustFees,
  );

  return router;
}
