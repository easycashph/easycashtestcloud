import { Router } from 'express';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { PsgcController, type PsgcControllerDeps } from '@modules/psgc/interface/http/psgcController';
import { createRequirePortalAuth } from './requirePortalAuth';

/** Same read-only PSGC lookups as the staff-facing psgcRouter.ts, mounted separately under
 * requirePortalAuth (the psgc module's own router is gated by the STAFF requireAuth, which
 * rejects a portal-signed token - see requirePortalAuth.ts's doc comment on the two auth realms
 * never overlapping). Powers the Easycash Portal loan application form's cascading address picker
 * (region -> province -> city -> barangay, with ZIP auto-fill), 2026-07-23. */
export function createPortalPsgcRouter(deps: PsgcControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PsgcController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.get('/psgc/regions', requirePortalAuth, controller.listRegions);
  router.get('/psgc/provinces', requirePortalAuth, controller.listProvinces);
  router.get('/psgc/cities', requirePortalAuth, controller.listCities);
  router.get('/psgc/barangays', requirePortalAuth, controller.listBarangays);
  router.get('/psgc/resolve-address', requirePortalAuth, controller.resolveAddressCodes);

  return router;
}
