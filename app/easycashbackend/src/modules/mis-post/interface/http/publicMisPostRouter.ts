import { Router } from 'express';
import { PublicMisPostController, type PublicMisPostControllerDeps } from './publicMisPostController';

/** No auth required (2026-08-20) - same reasoning as `publicAnnouncementRouter.ts`: a borrower
 * should see these even before logging in, straight from the public landing page. Mounted at the
 * shared /api/v1/portal prefix. */
export function createPublicMisPostRouter(deps: PublicMisPostControllerDeps): Router {
  const router = Router();
  const controller = new PublicMisPostController(deps);

  router.get('/mis-posts/active', controller.getActive);
  router.get('/mis-posts/:id/image', controller.getImage);

  return router;
}
