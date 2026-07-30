import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { StatementOfAccountController, type StatementOfAccountControllerDeps } from './statementOfAccountController';
import { generateStatementOfAccountSchema } from './statementOfAccountSchemas';

/** No role restriction beyond authentication — same access level as `GET /loan-accounts/:id` itself (ADR-052, mirrors ADR-051 §5). */
export function createStatementOfAccountRouter(deps: StatementOfAccountControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new StatementOfAccountController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post(
    '/loan-accounts/:id/statements-of-account',
    requireAuth,
    validateBody(generateStatementOfAccountSchema),
    controller.generate,
  );
  router.get('/loan-accounts/:id/statements-of-account', requireAuth, controller.list);
  router.get(
    '/loan-accounts/:id/statements-of-account/:generatedStatementId/download',
    requireAuth,
    controller.download,
  );

  return router;
}
