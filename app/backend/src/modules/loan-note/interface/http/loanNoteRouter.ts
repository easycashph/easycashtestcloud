import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { LoanNoteController, type LoanNoteControllerDeps } from './loanNoteController';
import { createLoanNoteSchema } from './loanNoteSchemas';

/** No role restriction beyond authentication for add/view — any staff working a loan account (Loan Officer, Collections, MIS, etc.) can add or view its notes, same access level as GET /loan-accounts/:id itself. Delete is MIS-only (2026-07-11 user decision) — the one permanent-deletion capability in this system, gated more narrowly than the rest of this router. */
export function createLoanNoteRouter(deps: LoanNoteControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanNoteController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/loan-accounts/:id/notes', requireAuth, validateBody(createLoanNoteSchema), controller.create);
  router.get('/loan-accounts/:id/notes', requireAuth, controller.list);
  router.delete('/loan-accounts/:id/notes/:noteId', requireAuth, requireRole('MIS'), controller.delete);

  return router;
}
