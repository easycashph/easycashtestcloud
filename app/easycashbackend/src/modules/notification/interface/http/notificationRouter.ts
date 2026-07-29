import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { NotificationController, type NotificationControllerDeps } from './notificationController';

/** Every authenticated user reads only their own notifications (scoped by recipientUserId inside
 * the use cases themselves, from the JWT - no role gate needed, same as `/audit-logs/view`). */
export function createNotificationRouter(deps: NotificationControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new NotificationController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/notifications', requireAuth, controller.list);
  router.patch('/notifications/:id/read', requireAuth, controller.markRead);
  router.post('/notifications/mark-all-read', requireAuth, controller.markAllRead);

  return router;
}
