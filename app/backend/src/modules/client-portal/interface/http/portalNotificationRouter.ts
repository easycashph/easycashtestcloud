import { Router } from 'express';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { createRequirePortalAuth } from './requirePortalAuth';
import { PortalNotificationController, type PortalNotificationControllerDeps } from './portalNotificationController';

/** Every authenticated portal account reads only its own notifications (scoped by portalAccountId
 * inside the use cases themselves, from the JWT), mirrors notificationRouter. */
export function createPortalNotificationRouter(deps: PortalNotificationControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalNotificationController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.get('/notifications', requirePortalAuth, controller.list);
  router.patch('/notifications/:id/read', requirePortalAuth, controller.markRead);
  router.post('/notifications/mark-all-read', requirePortalAuth, controller.markAllRead);

  return router;
}
