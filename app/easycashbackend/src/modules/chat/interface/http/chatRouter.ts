import { Router } from 'express';
import multer from 'multer';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { ChatController, type ChatControllerDeps } from './chatController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** Portal<->LMS support chat, staff side (2026-07-31 user request). Eligibility (who can claim
 * from the Waiting queue) is enforced inside the use cases themselves (see ChatEligibility.ts) -
 * every route here is just requireAuth. Transfer (2026-07-31 redesign) is no longer
 * role-restricted at all - any claimant can hand off to any LMS user via the PIN handoff flow. */
export function createChatRouter(deps: ChatControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new ChatController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/chat/queue', requireAuth, controller.listQueue);
  router.get('/chat/mine', requireAuth, controller.listMine);
  router.get('/chat/transfer-candidates', requireAuth, controller.listTransferCandidates);
  router.get('/chat/incoming-transfers', requireAuth, controller.listIncomingTransfers);
  // MIS-only oversight (2026-07-31 user request) - enforced inside the use cases themselves
  // (role check), same reasoning as the rest of this router.
  router.get('/chat/oversight/staff', requireAuth, controller.listOversightStaff);
  router.get('/chat/oversight/staff/:userId/conversations', requireAuth, controller.listOversightConversationsForStaff);
  router.get('/chat/oversight/conversations/:id', requireAuth, controller.getOversightConversation);
  router.get('/chat/:id', requireAuth, controller.get);
  router.post('/chat/:id/claim', requireAuth, controller.claim);
  router.post('/chat/:id/transfer/initiate', requireAuth, controller.initiateTransfer);
  router.post('/chat/:id/transfer/complete', requireAuth, controller.completeTransfer);
  router.post('/chat/:id/transfer/cancel', requireAuth, controller.cancelTransfer);
  router.post('/chat/:id/close', requireAuth, controller.close);
  router.post('/chat/:id/messages', requireAuth, upload.single('file'), controller.sendMessage);
  router.get('/chat/:id/attachments/:attachmentId/download', requireAuth, controller.downloadAttachment);

  return router;
}
