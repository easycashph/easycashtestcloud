import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { ListChatQueueUseCase } from '../../application/use-cases/ListChatQueueUseCase';
import type { ClaimChatConversationUseCase } from '../../application/use-cases/ClaimChatConversationUseCase';
import type { InitiateChatTransferUseCase } from '../../application/use-cases/InitiateChatTransferUseCase';
import type { CompleteChatTransferUseCase } from '../../application/use-cases/CompleteChatTransferUseCase';
import type { CancelChatTransferUseCase } from '../../application/use-cases/CancelChatTransferUseCase';
import type { ListChatTransferCandidatesUseCase } from '../../application/use-cases/ListChatTransferCandidatesUseCase';
import type { ListIncomingChatTransfersUseCase } from '../../application/use-cases/ListIncomingChatTransfersUseCase';
import type { SendStaffChatMessageUseCase } from '../../application/use-cases/SendStaffChatMessageUseCase';
import type { CloseChatConversationUseCase } from '../../application/use-cases/CloseChatConversationUseCase';
import type { ListMyClaimedChatConversationsUseCase } from '../../application/use-cases/ListMyClaimedChatConversationsUseCase';
import type { GetChatConversationForStaffUseCase } from '../../application/use-cases/GetChatConversationForStaffUseCase';
import type { DownloadChatAttachmentForStaffUseCase } from '../../application/use-cases/DownloadChatAttachmentForStaffUseCase';
import type { ListChatOversightStaffUseCase } from '../../application/use-cases/ListChatOversightStaffUseCase';
import type { ListChatConversationsForStaffUseCase } from '../../application/use-cases/ListChatConversationsForStaffUseCase';
import type { GetChatConversationForMisUseCase } from '../../application/use-cases/GetChatConversationForMisUseCase';

export interface ChatControllerDeps {
  listChatQueueUseCase: ListChatQueueUseCase;
  claimChatConversationUseCase: ClaimChatConversationUseCase;
  initiateChatTransferUseCase: InitiateChatTransferUseCase;
  completeChatTransferUseCase: CompleteChatTransferUseCase;
  cancelChatTransferUseCase: CancelChatTransferUseCase;
  listChatTransferCandidatesUseCase: ListChatTransferCandidatesUseCase;
  listIncomingChatTransfersUseCase: ListIncomingChatTransfersUseCase;
  sendStaffChatMessageUseCase: SendStaffChatMessageUseCase;
  closeChatConversationUseCase: CloseChatConversationUseCase;
  listMyClaimedChatConversationsUseCase: ListMyClaimedChatConversationsUseCase;
  getChatConversationForStaffUseCase: GetChatConversationForStaffUseCase;
  downloadChatAttachmentForStaffUseCase: DownloadChatAttachmentForStaffUseCase;
  listChatOversightStaffUseCase: ListChatOversightStaffUseCase;
  listChatConversationsForStaffUseCase: ListChatConversationsForStaffUseCase;
  getChatConversationForMisUseCase: GetChatConversationForMisUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture). */
export class ChatController {
  constructor(private readonly deps: ChatControllerDeps) {}

  listQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const queue = await this.deps.listChatQueueUseCase.execute(currentUser.sub);
      res.status(200).json(queue);
    } catch (error) {
      next(error);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const conversations = await this.deps.listMyClaimedChatConversationsUseCase.execute(currentUser.sub);
      res.status(200).json(conversations);
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const view = await this.deps.getChatConversationForStaffUseCase.execute(currentUser.sub, req.params.id as string);
      res.status(200).json(view);
    } catch (error) {
      next(error);
    }
  };

  claim = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const conversation = await this.deps.claimChatConversationUseCase.execute(currentUser.sub, req.params.id as string);
      res.status(200).json(conversation);
    } catch (error) {
      next(error);
    }
  };

  listTransferCandidates = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const candidates = await this.deps.listChatTransferCandidatesUseCase.execute();
      res.status(200).json(candidates);
    } catch (error) {
      next(error);
    }
  };

  listIncomingTransfers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const conversations = await this.deps.listIncomingChatTransfersUseCase.execute(currentUser.sub);
      res.status(200).json(conversations);
    } catch (error) {
      next(error);
    }
  };

  initiateTransfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const body = req.body as { toUserId: string; pin: string };
      const conversation = await this.deps.initiateChatTransferUseCase.execute(currentUser.sub, req.params.id as string, body.toUserId, body.pin);
      res.status(200).json(conversation);
    } catch (error) {
      next(error);
    }
  };

  completeTransfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const body = req.body as { pin: string };
      const conversation = await this.deps.completeChatTransferUseCase.execute(currentUser.sub, req.params.id as string, body.pin);
      res.status(200).json(conversation);
    } catch (error) {
      next(error);
    }
  };

  cancelTransfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      await this.deps.cancelChatTransferUseCase.execute(currentUser.sub, req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  close = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      await this.deps.closeChatConversationUseCase.execute(currentUser.sub, req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const body = typeof req.body?.body === 'string' ? req.body.body : undefined;
      if (body !== undefined && body.length > 4000) {
        throw new ValidationError('Message is too long (max 4000 characters).');
      }
      const message = await this.deps.sendStaffChatMessageUseCase.execute({
        userId: currentUser.sub,
        conversationId: req.params.id as string,
        body,
        file: req.file ? { fileName: req.file.originalname, fileType: req.file.mimetype, data: req.file.buffer } : undefined,
      });
      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  };

  listOversightStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const staff = await this.deps.listChatOversightStaffUseCase.execute(currentUser.sub);
      res.status(200).json(staff);
    } catch (error) {
      next(error);
    }
  };

  listOversightConversationsForStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const conversations = await this.deps.listChatConversationsForStaffUseCase.execute(currentUser.sub, req.params.userId as string);
      res.status(200).json(conversations);
    } catch (error) {
      next(error);
    }
  };

  getOversightConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const view = await this.deps.getChatConversationForMisUseCase.execute(currentUser.sub, req.params.id as string);
      res.status(200).json(view);
    } catch (error) {
      next(error);
    }
  };

  downloadAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const { record, data } = await this.deps.downloadChatAttachmentForStaffUseCase.execute(
        currentUser.sub,
        req.params.id as string,
        req.params.attachmentId as string,
      );
      res.setHeader('Content-Type', record.fileType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.fileName)}"`);
      res.status(200).send(data);
    } catch (error) {
      next(error);
    }
  };
}
