import { Router } from 'express';
import multer from 'multer';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { AiExtractionController, type AiExtractionControllerDeps } from './aiExtractionController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Ephemeral, not persisted — deliberately separate from `/attachments` (document module). This
 * exists to prefill the Create Loan Application form BEFORE the application record (and therefore
 * a real attachment owner id) exists. The file is never written to storage or the database here;
 * if the officer wants the file kept, it's uploaded again as a real attachment after the
 * application is created, via the existing /attachments endpoint.
 */
export function createAiExtractionRouter(deps: AiExtractionControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new AiExtractionController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.post(
    '/ai-extraction/loan-application-fields',
    requireAuth,
    requirePermission('ai_extraction.use'),
    upload.single('file'),
    controller.extract,
  );

  return router;
}
