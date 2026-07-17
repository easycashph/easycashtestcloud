import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { PsgcController, type PsgcControllerDeps } from './psgcController';

/** Read-only static reference data — every authenticated role may read it, no branch scoping applies. */
export function createPsgcRouter(deps: PsgcControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new PsgcController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/psgc/regions', requireAuth, controller.listRegions);
  router.get('/psgc/provinces', requireAuth, controller.listProvinces);
  router.get('/psgc/cities', requireAuth, controller.listCities);
  router.get('/psgc/barangays', requireAuth, controller.listBarangays);
  router.get('/psgc/resolve-address', requireAuth, controller.resolveAddressCodes);

  return router;
}
