import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { UploadAttachmentUseCase } from '../../application/use-cases/UploadAttachmentUseCase';
import type { ListAttachmentsForOwnerUseCase } from '../../application/use-cases/ListAttachmentsForOwnerUseCase';
import type { DownloadAttachmentUseCase } from '../../application/use-cases/DownloadAttachmentUseCase';
import { attachmentOwnerTypeSchema, uploadAttachmentBodySchema } from './documentSchemas';
import { presentAttachment } from './presenters/AttachmentPresenter';

/** `Attachment.fileType` holds a real MIME type for attachments uploaded through the app, but a
 * plain file extension (".jpg", ".pdf") for rows backfilled from the legacy SDevTech export
 * (scripts/backfill-legacy-attachments.ts) - see AttachmentPreviewModal.tsx's resolvePreviewKind
 * for the frontend half of this same mismatch. Serving an extension as-is in the Content-Type
 * header produces an invalid value that Chrome's built-in PDF viewer refuses to render inline
 * (an <img> tag is more lenient and mostly still worked, which is why only PDFs looked broken). */
const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

function resolveContentType(fileType: string): string {
  return MIME_TYPE_BY_EXTENSION[fileType.toLowerCase()] ?? fileType;
}

export interface DocumentControllerDeps {
  uploadAttachmentUseCase: UploadAttachmentUseCase;
  listAttachmentsForOwnerUseCase: ListAttachmentsForOwnerUseCase;
  downloadAttachmentUseCase: DownloadAttachmentUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class DocumentController {
  constructor(private readonly deps: DocumentControllerDeps) {}

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError('No file was uploaded (expected multipart field "file").');
      }
      const body = uploadAttachmentBodySchema.parse(req.body);
      const currentUser = getCurrentUser(req);
      const attachment = await this.deps.uploadAttachmentUseCase.execute({
        ownerType: body.ownerType,
        ownerId: body.ownerId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        data: req.file.buffer,
        documentCategory: body.documentCategory ?? null,
        uploadedByUserId: currentUser.sub,
      });
      res.status(201).json(presentAttachment(attachment));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerType = attachmentOwnerTypeSchema.parse(req.query.ownerType);
      const ownerId = String(req.query.ownerId ?? '');
      if (!ownerId) throw new ValidationError('ownerId query parameter is required.');
      const attachments = await this.deps.listAttachmentsForOwnerUseCase.execute(ownerType, ownerId);
      res.status(200).json(attachments.map(presentAttachment));
    } catch (error) {
      next(error);
    }
  };

  download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { record, data } = await this.deps.downloadAttachmentUseCase.execute(req.params.id as string);
      res.setHeader('Content-Type', resolveContentType(record.fileType));
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.fileName)}"`);
      res.status(200).send(data);
    } catch (error) {
      next(error);
    }
  };
}
