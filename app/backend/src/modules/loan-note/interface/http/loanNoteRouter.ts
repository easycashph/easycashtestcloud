import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { LoanNoteController, type LoanNoteControllerDeps } from './loanNoteController';
import { createLoanNoteSchema } from './loanNoteSchemas';

/** No role restriction beyond authentication — any staff working a loan account (Loan Officer, Collections, MIS, etc.) can add or view its notes, same access level as GET /loan-accounts/:id itself. */
export function createLoanNoteRouter(deps: LoanNoteControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanNoteController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/loan-accounts/:id/notes', requireAuth, validateBody(createLoanNoteSchema), controller.create);
  router.get('/loan-accounts/:id/notes', requireAuth, controller.list);

  return router;
}
