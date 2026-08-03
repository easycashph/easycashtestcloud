import { Router } from 'express';
import { validateBody } from '@shared/middleware/validate';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { createRequirePortalAuth } from './requirePortalAuth';
import { PortalSecurityController, type PortalSecurityControllerDeps } from './portalSecurityController';
import {
  changePortalPasswordSchema,
  changePortalEmailSchema,
  requestEnablePortalTwoFactorSchema,
  confirmEnablePortalTwoFactorSchema,
  disablePortalTwoFactorSchema,
} from './portalSecuritySchemas';

/** Portal Security tab (2026-07-27 user request) - self-service email/password change, gated by
 * the current password. Mounted at the same /api/v1/portal prefix as every other portal router. */
export function createPortalSecurityRouter(deps: PortalSecurityControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalSecurityController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.post('/security/change-password', requirePortalAuth, validateBody(changePortalPasswordSchema), controller.changePassword);
  router.patch('/security/email', requirePortalAuth, validateBody(changePortalEmailSchema), controller.changeEmail);
  router.post(
    '/security/2fa/request-enable',
    requirePortalAuth,
    validateBody(requestEnablePortalTwoFactorSchema),
    controller.requestEnableTwoFactor,
  );
  router.post(
    '/security/2fa/confirm-enable',
    requirePortalAuth,
    validateBody(confirmEnablePortalTwoFactorSchema),
    controller.confirmEnableTwoFactor,
  );
  router.post('/security/2fa/disable', requirePortalAuth, validateBody(disablePortalTwoFactorSchema), controller.disableTwoFactor);
  router.get('/security/trusted-devices', requirePortalAuth, controller.listTrustedDevices);
  router.delete('/security/trusted-devices/:id', requirePortalAuth, controller.revokeTrustedDevice);

  return router;
}
