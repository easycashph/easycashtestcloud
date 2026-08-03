import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import type { StartOrResumePortalChatUseCase } from '../../application/use-cases/StartOrResumePortalChatUseCase';
import type { GetPortalChatUseCase } from '../../application/use-cases/GetPortalChatUseCase';
import type { SendPortalChatMessageUseCase } from '../../application/use-cases/SendPortalChatMessageUseCase';
import type { DownloadPortalChatAttachmentUseCase } from '../../application/use-cases/DownloadPortalChatAttachmentUseCase';
import { getCurrentPortalAccount } from '@modules/client-portal/interface/http/requirePortalAuth';

export interface PortalChatControllerDeps {
  startOrResumePortalChatUseCase: StartOrResumePortalChatUseCase;
  getPortalChatUseCase: GetPortalChatUseCase;
  sendPortalChatMessageUseCase: SendPortalChatMessageUseCase;
  downloadPortalChatAttachmentUseCase: DownloadPortalChatAttachmentUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture). */
export class PortalChatController {
  constructor(private readonly deps: PortalChatControllerDeps) {}

  start = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const conversation = await this.deps.startOrResumePortalChatUseCase.execute(account.sub);
      res.status(200).json(conversation);
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const view = await this.deps.getPortalChatUseCase.execute(account.sub, req.params.id as string);
      res.status(200).json(view);
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = typeof req.body?.body === 'string' ? req.body.body : undefined;
      if (body !== undefined && body.length > 4000) {
        throw new ValidationError('Message is too long (max 4000 characters).');
      }
      const message = await this.deps.sendPortalChatMessageUseCase.execute({
        portalAccountId: account.sub,
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
      const account = getCurrentPortalAccount(req);
      const { record, data } = await this.deps.downloadPortalChatAttachmentUseCase.execute(
        account.sub,
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
