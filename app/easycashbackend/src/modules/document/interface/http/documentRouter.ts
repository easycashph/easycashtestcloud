import { Router } from 'express';
import multer from 'multer';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { DocumentController, type DocumentControllerDeps } from './documentController';

/** 2026-08-06: `attachment.upload` moved to a DB-backed `requirePermission` check (Roles &
 * Permissions feature). Default grant: same role set as loan-application's own write gate (MIS,
 * Loan Operation Manager, CRM) — whoever may encode/decide an application may attach its
 * supporting documents. Reads (list/download) remain open to any authenticated role. */

// Buffered in memory, not streamed to a temp file — attachments here are small scans/PDFs (10 MB
// cap enforced again inside UploadAttachmentUseCase, not just here) so this is a deliberate
// simplicity/safety tradeoff, not an oversight.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function createDocumentRouter(deps: DocumentControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new DocumentController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post('/attachments', requireAuth, requirePermission('attachment.upload'), upload.single('file'), controller.upload);
  router.get('/attachments', requireAuth, controller.list);
  router.get('/attachments/:id/download', requireAuth, controller.download);

  return router;
}
