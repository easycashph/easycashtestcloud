import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { validateBody } from '@shared/middleware/validate';
import { BulkExportController, type BulkExportControllerDeps } from './bulkExportController';
import { createBulkExportJobSchema } from './bulkExportSchemas';

/** MIS bulk document export (2026-08-24, moved onto the DB-backed permission system 2026-08-24
 * follow-up per user request) - gated by `bulk_export.use`, not a hardcoded `requireRole('MIS')`.
 * MIS is the only role granted it by default (seed.ts) - same effective restriction as before, but
 * now configurable from the Roles & Permissions screen instead of requiring a code change. */
export function createBulkExportRouter(deps: BulkExportControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new BulkExportController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const canExport = requirePermission('bulk_export.use');

  router.get('/bulk-exports/default-range', requireAuth, canExport, controller.defaultRange);
  router.get('/bulk-exports', requireAuth, canExport, controller.listMine);
  router.post('/bulk-exports', requireAuth, canExport, validateBody(createBulkExportJobSchema), controller.create);
  router.get('/bulk-exports/:id/download', requireAuth, canExport, controller.download);
  router.post('/bulk-exports/:id/cancel', requireAuth, canExport, controller.cancel);

  return router;
}
