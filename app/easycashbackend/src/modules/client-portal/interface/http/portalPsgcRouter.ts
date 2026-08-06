import { Router } from 'express';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { PsgcController, type PsgcControllerDeps } from '@modules/psgc/interface/http/psgcController';
import { cacheControl } from '@shared/middleware/cacheControl';
import { createRequirePortalAuth } from './requirePortalAuth';

/** PSGC (Philippine Standard Geographic Code) reference data effectively never changes -
 * 24h `private` caching (2026-08-06 performance audit) removes a DB round trip from the loan
 * application form's address picker on every keystroke/step, without letting any shared cache
 * (CDN/proxy) reuse an authenticated response across different portal accounts. */
const psgcCache = cacheControl(86400, 'private');

/** Same read-only PSGC lookups as the staff-facing psgcRouter.ts, mounted separately under
 * requirePortalAuth (the psgc module's own router is gated by the STAFF requireAuth, which
 * rejects a portal-signed token - see requirePortalAuth.ts's doc comment on the two auth realms
 * never overlapping). Powers the Easycash Portal loan application form's cascading address picker
 * (region -> province -> city -> barangay, with ZIP auto-fill), 2026-07-23. */
export function createPortalPsgcRouter(deps: PsgcControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PsgcController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.get('/psgc/regions', requirePortalAuth, psgcCache, controller.listRegions);
  router.get('/psgc/provinces', requirePortalAuth, psgcCache, controller.listProvinces);
  router.get('/psgc/cities', requirePortalAuth, psgcCache, controller.listCities);
  router.get('/psgc/barangays', requirePortalAuth, psgcCache, controller.listBarangays);
  router.get('/psgc/resolve-address', requirePortalAuth, psgcCache, controller.resolveAddressCodes);

  return router;
}
