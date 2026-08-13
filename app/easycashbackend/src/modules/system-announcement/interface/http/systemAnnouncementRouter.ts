import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { validateBody } from '@shared/middleware/validate';
import { SystemAnnouncementController, type SystemAnnouncementControllerDeps } from './systemAnnouncementController';
import { createSystemAnnouncementSchema, updateSystemAnnouncementSchema } from './systemAnnouncementSchemas';

/** Gated by `system_announcement.manage` (Roles & Permissions feature), MIS-only by default
 * (user's explicit request 2026-08-14: "si MIS ang mag popost"). `GET /system-announcements/active`
 * is the exception - every authenticated LMS user needs it to render the popup, not just MIS. */
export function createSystemAnnouncementRouter(deps: SystemAnnouncementControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new SystemAnnouncementController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const misOnly = requirePermission('system_announcement.manage');

  // Registered before the ':id' route below - Express matches routes in registration order, and
  // 'active' would otherwise be captured as an :id param by the more general route.
  router.get('/system-announcements/active', requireAuth, controller.getActiveForLms);
  router.get('/system-announcements', requireAuth, misOnly, controller.list);
  router.post('/system-announcements', requireAuth, misOnly, validateBody(createSystemAnnouncementSchema), controller.create);
  router.patch('/system-announcements/:id', requireAuth, misOnly, validateBody(updateSystemAnnouncementSchema), controller.update);
  router.delete('/system-announcements/:id', requireAuth, misOnly, controller.delete);

  return router;
}
