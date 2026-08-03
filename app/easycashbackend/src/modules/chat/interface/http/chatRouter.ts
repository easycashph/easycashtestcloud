import { Router } from 'express';
import multer from 'multer';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { ChatController, type ChatControllerDeps } from './chatController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** Portal<->LMS support chat, staff side (2026-07-31 user request). Eligibility (who can see/claim
 * the queue, who can transfer to a manager) is enforced inside the use cases themselves (see
 * ChatEligibility.ts) - it's role-CLASS-sensitive for the manager case, which the simple
 * requireRole(...) middleware can't express, so every route here is just requireAuth. */
export function createChatRouter(deps: ChatControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new ChatController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/chat/queue', requireAuth, controller.listQueue);
  router.get('/chat/mine', requireAuth, controller.listMine);
  // MIS-only oversight (2026-07-31 user request) - enforced inside the use cases themselves
  // (role check), same reasoning as the rest of this router.
  router.get('/chat/oversight/staff', requireAuth, controller.listOversightStaff);
  router.get('/chat/oversight/staff/:userId/conversations', requireAuth, controller.listOversightConversationsForStaff);
  router.get('/chat/oversight/conversations/:id', requireAuth, controller.getOversightConversation);
  router.get('/chat/:id', requireAuth, controller.get);
  router.post('/chat/:id/claim', requireAuth, controller.claim);
  router.post('/chat/:id/transfer', requireAuth, controller.transfer);
  router.post('/chat/:id/close', requireAuth, controller.close);
  router.post('/chat/:id/messages', requireAuth, upload.single('file'), controller.sendMessage);
  router.get('/chat/:id/attachments/:attachmentId/download', requireAuth, controller.downloadAttachment);

  return router;
}
