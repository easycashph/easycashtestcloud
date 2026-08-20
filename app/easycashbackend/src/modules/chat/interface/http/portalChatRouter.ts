import { Router } from 'express';
import multer from 'multer';
import type { IPortalTokenService } from '@modules/client-portal/application/ports/IPortalTokenService';
import { createRequirePortalAuth } from '@modules/client-portal/interface/http/requirePortalAuth';
import { PortalChatController, type PortalChatControllerDeps } from './portalChatController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** Portal<->LMS support chat, client side (2026-07-31 user request). Mounted at the same
 * /api/v1/portal prefix as every other portal router. */
export function createPortalChatRouter(deps: PortalChatControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalChatController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.post('/chat/start', requirePortalAuth, controller.start);
  router.get('/chat/active', requirePortalAuth, controller.getActive);
  router.get('/chat/:id', requirePortalAuth, controller.get);
  router.post('/chat/:id/messages', requirePortalAuth, upload.single('file'), controller.sendMessage);
  router.post('/chat/:id/typing', requirePortalAuth, controller.typing);
  router.post('/chat/:id/rating', requirePortalAuth, controller.submitRating);
  router.get('/chat/:id/attachments/:attachmentId/download', requirePortalAuth, controller.downloadAttachment);

  return router;
}
