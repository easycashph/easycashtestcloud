import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { streamZipResponse } from '@shared/http/streamZipResponse';
import { resolveAttachmentFileName } from '../../application/resolveAttachmentFileName';
import type { UploadAttachmentUseCase } from '../../application/use-cases/UploadAttachmentUseCase';
import type { ListAttachmentsForOwnerUseCase } from '../../application/use-cases/ListAttachmentsForOwnerUseCase';
import type { DownloadAttachmentUseCase } from '../../application/use-cases/DownloadAttachmentUseCase';
import type { DownloadAllBorrowerDocumentsUseCase } from '../../application/use-cases/DownloadAllBorrowerDocumentsUseCase';
import type { RecheckLoanApplicationDocumentCompletenessUseCase } from '@modules/loan-application/application/use-cases/RecheckLoanApplicationDocumentCompletenessUseCase';
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
  downloadAllBorrowerDocumentsUseCase: DownloadAllBorrowerDocumentsUseCase;
  /** 2026-09-12 (user request): optional so existing tests/mocks of this controller don't need
   * updating - only wired in production DI (app.ts). See RecheckLoanApplicationDocumentCompleteness
   * UseCase's own doc comment. */
  recheckLoanApplicationDocumentCompletenessUseCase?: RecheckLoanApplicationDocumentCompletenessUseCase;
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

      // 2026-09-12 (user request): required-document uploads can flip an INCOMPLETE loan
      // application to its real PREAPPROVED/PREDECLINED verdict - cheap no-op for every other
      // owner type/status, so unconditional here rather than every upload caller remembering to
      // trigger it.
      if (body.ownerType === 'LOAN_APPLICATION' && this.deps.recheckLoanApplicationDocumentCompletenessUseCase) {
        await this.deps.recheckLoanApplicationDocumentCompletenessUseCase.execute(body.ownerId);
      }

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
      const fileName = resolveAttachmentFileName(record.fileName, record.fileType);
      res.setHeader('Content-Type', resolveContentType(record.fileType));
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.status(200).send(data);
    } catch (error) {
      next(error);
    }
  };

  downloadAllForBorrower = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { zipFileName, entries } = await this.deps.downloadAllBorrowerDocumentsUseCase.execute(req.params.id as string);
      streamZipResponse(res, zipFileName, entries);
    } catch (error) {
      next(error);
    }
  };
}
