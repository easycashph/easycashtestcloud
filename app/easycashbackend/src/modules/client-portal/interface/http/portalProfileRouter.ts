import { Router } from 'express';
import multer from 'multer';
import { validateBody } from '@shared/middleware/validate';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { createRequirePortalAuth } from './requirePortalAuth';
import { PortalProfileController, type PortalProfileControllerDeps } from './portalProfileController';
import { updatePortalProfileSchema } from './portalProfileSchemas';

// Same buffered-memory-storage/10MB-cap pattern as the loan-application document upload's own
// multer wiring (portalLoanApplicationRouter.ts).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** Phase D (2026-07-24 user request): a logged-in portal account can view/edit its own client
 * profile once linked to a Borrower (see PortalAccount.borrowerId, set at "Create Client Profile"
 * time). Mounted at the same /api/v1/portal prefix as every other portal router. */
export function createPortalProfileRouter(deps: PortalProfileControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalProfileController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.get('/profile', requirePortalAuth, controller.get);
  router.patch('/profile', requirePortalAuth, validateBody(updatePortalProfileSchema), controller.update);
  // "Chat with your loan officer" dashboard card (2026-08-06) - first name only, see the use
  // case's own doc comment.
  router.get('/loan-officer', requirePortalAuth, controller.loanOfficer);
  // Profile photo (2026-09-14 user request: "make profile picture mandatory") - see
  // UploadPortalProfilePhotoUseCase's own doc comment for why this is separate from the existing
  // LoanApplication-scoped document upload.
  router.post('/profile/photo', requirePortalAuth, upload.single('file'), controller.uploadPhoto);
  router.get('/profile/photo', requirePortalAuth, controller.downloadPhoto);

  return router;
}
