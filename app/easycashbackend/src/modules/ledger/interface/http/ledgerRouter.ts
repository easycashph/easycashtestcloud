import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { LedgerController, type LedgerControllerDeps } from './ledgerController';

/**
 * D-2 (approved): read-only. No write route exists here at all —
 * RecordLoanTransactionUseCase is not wired to any router.
 */
export function createLedgerRouter(deps: LedgerControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LedgerController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/loan-accounts/:loanAccountId/transactions', requireAuth, controller.listForAccount);
  router.get('/transactions/:id', requireAuth, controller.get);
  router.get('/transactions/:id/allocations', requireAuth, controller.listAllocations);

  return router;
}
