import { Router } from 'express';
import multer from 'multer';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { DocumentController, type DocumentControllerDeps } from './documentController';

/** Same role set as loan-application's own write gate — whoever may encode/decide an application
 * may attach its supporting documents. Reads (list/download) only require authentication, matching
 * the precedent set by borrower/loan-account's own GET routes. */
const ATTACHMENT_WRITE_ROLES = ['MIS', 'Loan Operation Manager', 'CRM'];

// Buffered in memory, not streamed to a temp file — attachments here are small scans/PDFs (10 MB
// cap enforced again inside UploadAttachmentUseCase, not just here) so this is a deliberate
// simplicity/safety tradeoff, not an oversight.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function createDocumentRouter(deps: DocumentControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new DocumentController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/attachments', requireAuth, requireRole(...ATTACHMENT_WRITE_ROLES), upload.single('file'), controller.upload);
  router.get('/attachments', requireAuth, controller.list);
  router.get('/attachments/:id/download', requireAuth, controller.download);

  return router;
}
