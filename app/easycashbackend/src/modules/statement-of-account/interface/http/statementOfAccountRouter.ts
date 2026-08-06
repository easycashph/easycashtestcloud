import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { StatementOfAccountController, type StatementOfAccountControllerDeps } from './statementOfAccountController';
import { generateStatementOfAccountSchema } from './statementOfAccountSchemas';

/**
 * 2026-08-06: generating a Statement of Account is now gated by `statement_of_account.generate`
 * (Roles & Permissions feature) — previously no role restriction at all beyond authentication
 * (ADR-052, mirrors ADR-051 §5), same gap `document.generate`/`esignature.manage` had. Default
 * grant is every role (preserving that prior behavior), configurable by MIS from there. Viewing/
 * downloading an already-generated statement remains open to any authenticated role, unchanged.
 */
export function createStatementOfAccountRouter(deps: StatementOfAccountControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new StatementOfAccountController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post(
    '/loan-accounts/:id/statements-of-account',
    requireAuth,
    requirePermission('statement_of_account.generate'),
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
