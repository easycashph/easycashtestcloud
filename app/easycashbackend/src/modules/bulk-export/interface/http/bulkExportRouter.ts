import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { validateBody } from '@shared/middleware/validate';
import { BulkExportController, type BulkExportControllerDeps } from './bulkExportController';
import { createBulkExportJobSchema } from './bulkExportSchemas';

/** MIS bulk document export (2026-08-24 user request) - every route here is MIS-only
 * (`requireRole('MIS')`), same pattern as every other hard-restricted-to-MIS route in this
 * codebase (not the DB-backed `requirePermission` - this is a deliberate hard restriction, not
 * something MIS should be able to reconfigure via the Roles & Permissions screen). */
export function createBulkExportRouter(deps: BulkExportControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new BulkExportController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const misOnly = requireRole('MIS');

  router.get('/bulk-exports/default-range', requireAuth, misOnly, controller.defaultRange);
  router.get('/bulk-exports', requireAuth, misOnly, controller.listMine);
  router.post('/bulk-exports', requireAuth, misOnly, validateBody(createBulkExportJobSchema), controller.create);
  router.get('/bulk-exports/:id/download', requireAuth, misOnly, controller.download);

  return router;
}
