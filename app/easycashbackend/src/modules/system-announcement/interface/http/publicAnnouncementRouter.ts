import { Router } from 'express';
import { PublicAnnouncementController, type PublicAnnouncementControllerDeps } from './publicAnnouncementController';

/** No auth required (2026-08-14) - a maintenance/news announcement is deliberately not sensitive,
 * and a client should see it even before logging in (e.g. on the public landing page). Mounted at
 * the same /api/v1/portal prefix as every other portal router. */
export function createPublicAnnouncementRouter(deps: PublicAnnouncementControllerDeps): Router {
  const router = Router();
  const controller = new PublicAnnouncementController(deps);

  router.get('/announcements/active', controller.getActiveForPortal);

  return router;
}
