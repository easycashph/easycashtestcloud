import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { LicensedRecruitmentAgencyController, type LicensedRecruitmentAgencyControllerDeps } from './licensedRecruitmentAgencyController';

/** Read-only. Every authenticated role may search - needed by anyone filling in a Seafarer Loan's Agency/contract verification. */
export function createLicensedRecruitmentAgencyRouter(deps: LicensedRecruitmentAgencyControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new LicensedRecruitmentAgencyController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/licensed-recruitment-agencies', requireAuth, controller.search);

  return router;
}
