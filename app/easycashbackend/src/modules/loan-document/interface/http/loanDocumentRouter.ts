import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { LoanDocumentController, type LoanDocumentControllerDeps } from './loanDocumentController';
import { generateLoanDocumentSchema } from './loanDocumentSchemas';

/** No role restriction beyond authentication — same access level as GET /loan-accounts/:id itself (ADR-051 §5: any staff working a loan account can generate/view/download its documents). */
export function createLoanDocumentRouter(deps: LoanDocumentControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LoanDocumentController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/loan-accounts/:id/documents', requireAuth, validateBody(generateLoanDocumentSchema), controller.generate);
  router.get('/loan-accounts/:id/documents', requireAuth, controller.list);
  router.get('/loan-accounts/:id/documents/:generatedDocumentId/download', requireAuth, controller.download);

  return router;
}
