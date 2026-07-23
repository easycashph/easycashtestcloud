import { Router } from 'express';
import multer from 'multer';
import { validateBody } from '@shared/middleware/validate';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { createRequirePortalAuth } from './requirePortalAuth';
import { PortalLoanApplicationController, type PortalLoanApplicationControllerDeps } from './portalLoanApplicationController';
import { submitLoanApplicationSchema } from './portalLoanApplicationSchemas';

// Same buffered-memory-storage/10MB-cap pattern as the document module's own multer wiring
// (documentRouter.ts) — small scans/PDFs, no need for disk temp files.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function createPortalLoanApplicationRouter(deps: PortalLoanApplicationControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalLoanApplicationController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.get('/branches', requirePortalAuth, controller.listBranches);
  router.post('/loan-applications', requirePortalAuth, validateBody(submitLoanApplicationSchema), controller.submit);
  router.get('/loan-applications', requirePortalAuth, controller.list);
  router.post('/loan-applications/:id/documents', requirePortalAuth, upload.single('file'), controller.uploadDocument);

  return router;
}
