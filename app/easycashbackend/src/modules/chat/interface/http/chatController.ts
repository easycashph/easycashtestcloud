import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { ListChatQueueUseCase } from '../../application/use-cases/ListChatQueueUseCase';
import type { ClaimChatConversationUseCase } from '../../application/use-cases/ClaimChatConversationUseCase';
import type { TransferChatConversationToManagerUseCase } from '../../application/use-cases/TransferChatConversationToManagerUseCase';
import type { SendStaffChatMessageUseCase } from '../../application/use-cases/SendStaffChatMessageUseCase';
import type { CloseChatConversationUseCase } from '../../application/use-cases/CloseChatConversationUseCase';
import type { ListMyClaimedChatConversationsUseCase } from '../../application/use-cases/ListMyClaimedChatConversationsUseCase';
import type { GetChatConversationForStaffUseCase } from '../../application/use-cases/GetChatConversationForStaffUseCase';
import type { DownloadChatAttachmentForStaffUseCase } from '../../application/use-cases/DownloadChatAttachmentForStaffUseCase';

export interface ChatControllerDeps {
  listChatQueueUseCase: ListChatQueueUseCase;
  claimChatConversationUseCase: ClaimChatConversationUseCase;
  transferChatConversationToManagerUseCase: TransferChatConversationToManagerUseCase;
  sendStaffChatMessageUseCase: SendStaffChatMessageUseCase;
  closeChatConversationUseCase: CloseChatConversationUseCase;
  listMyClaimedChatConversationsUseCase: ListMyClaimedChatConversationsUseCase;
  getChatConversationForStaffUseCase: GetChatConversationForStaffUseCase;
  downloadChatAttachmentForStaffUseCase: DownloadChatAttachmentForStaffUseCase;
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

  transfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      await this.deps.transferChatConversationToManagerUseCase.execute(currentUser.sub, req.params.id as string);
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
