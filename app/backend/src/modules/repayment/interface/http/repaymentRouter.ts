import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { RepaymentController, type RepaymentControllerDeps } from './repaymentController';

/**
 * D-2 (approved): read-only. No write route exists here at all —
 * CreateRepaymentInstallmentUseCase and RecordInstallmentPaymentUseCase
 * are not wired to any router.
 */
export function createRepaymentRouter(deps: RepaymentControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new RepaymentController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/loan-accounts/:loanAccountId/repayment-schedule', requireAuth, controller.listForLoan);
  router.get('/repayment-installments/:id', requireAuth, controller.get);

  return router;
}
