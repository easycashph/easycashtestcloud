import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { LoanSigningController, type LoanSigningControllerDeps } from './loanSigningController';
import { createLoanSigningSessionSchema } from './loanSigningSchemas';

/** Staff-side (authenticated) routes. No role restriction beyond authentication - same access
 * level as `loanDocumentRouter`'s own routes (ADR-051 §5: any staff working a loan account can
 * generate/view its documents; sending them for signature is the same class of action). */
export function createLoanSigningRouter(deps: LoanSigningControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanSigningController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post(
    '/loan-accounts/:loanAccountId/signing-sessions',
    requireAuth,
    validateBody(createLoanSigningSessionSchema),
    controller.create,
  );
  router.get('/loan-accounts/:loanAccountId/signing-sessions', requireAuth, controller.list);

  return router;
}
