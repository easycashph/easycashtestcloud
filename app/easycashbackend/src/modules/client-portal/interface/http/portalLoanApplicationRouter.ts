import { Router } from 'express';
import multer from 'multer';
import { validateBody } from '@shared/middleware/validate';
import { cacheControl } from '@shared/middleware/cacheControl';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { createRequirePortalAuth } from './requirePortalAuth';
import { PortalLoanApplicationController, type PortalLoanApplicationControllerDeps } from './portalLoanApplicationController';
import { submitLoanApplicationSchema, updateLoanApplicationSchema } from './portalLoanApplicationSchemas';

// Same buffered-memory-storage/10MB-cap pattern as the document module's own multer wiring
// (documentRouter.ts) — small scans/PDFs, no need for disk temp files.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function createPortalLoanApplicationRouter(deps: PortalLoanApplicationControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalLoanApplicationController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  // Branch list rarely changes - 1h private caching (2026-08-06 performance audit) removes a DB
  // round trip from every loan application form load.
  router.get('/branches', requirePortalAuth, cacheControl(3600, 'private'), controller.listBranches);
  router.post('/loan-applications', requirePortalAuth, validateBody(submitLoanApplicationSchema), controller.submit);
  router.get('/loan-applications', requirePortalAuth, controller.list);
  router.get('/loan-applications/:id', requirePortalAuth, controller.get);
  router.get('/loan-applications/:id/status-timeline', requirePortalAuth, controller.getStatusTimeline);
  router.patch('/loan-applications/:id', requirePortalAuth, validateBody(updateLoanApplicationSchema), controller.update);
  router.post('/loan-applications/:id/documents', requirePortalAuth, upload.single('file'), controller.uploadDocument);
  router.get('/loan-applications/:id/documents', requirePortalAuth, controller.listDocuments);
  router.get('/loan-applications/:id/documents/:documentId/download', requirePortalAuth, controller.downloadDocument);

  return router;
}
