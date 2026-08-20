import { Router } from 'express';
import multer from 'multer';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { MisPostController, type MisPostControllerDeps } from './misPostController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** MIS-only (2026-08-20 user request), gated by the same `system_announcement.manage` permission
 * as the existing announcement popup - both are "si MIS ang mag popost" features. */
export function createMisPostRouter(deps: MisPostControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new MisPostController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const misOnly = requirePermission('system_announcement.manage');

  router.get('/mis-posts', requireAuth, misOnly, controller.list);
  router.post('/mis-posts/manual', requireAuth, misOnly, upload.single('image'), controller.createManual);
  router.delete('/mis-posts/manual/:id', requireAuth, misOnly, controller.withdraw);

  return router;
}
