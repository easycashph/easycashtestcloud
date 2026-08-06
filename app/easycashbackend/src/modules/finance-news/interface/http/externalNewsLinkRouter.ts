import { Router } from 'express';
import { ExternalNewsLinkController, type ExternalNewsLinkControllerDeps } from './externalNewsLinkController';

/**
 * Automated PH Lending/Finance News + Road/Weather Advisory feed (2026-08-06 user request) -
 * public, unauthenticated (no `requirePortalAuth`), same posture as `portalPsgcRouter.ts`:
 * reference/informational content, not account-specific, readable by a visitor who hasn't signed
 * up yet. Mounted at the same /api/v1/portal prefix as every other portal router.
 */
export function createExternalNewsLinkRouter(deps: ExternalNewsLinkControllerDeps): Router {
  const router = Router();
  const controller = new ExternalNewsLinkController(deps);

  router.get('/finance-news', controller.list);

  return router;
}
