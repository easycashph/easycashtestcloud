import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { ValidationError } from '@shared/errors/DomainError';
import type {
  AttachmentDocumentCategory,
  AttachmentOwnerType,
  AttachmentRecord,
  IAttachmentRepository,
} from '../ports/IAttachmentRepository';
import type { IFileStorage } from '../ports/IFileStorage';

/** Whitelist, not a blocklist — CLAUDE.md Security. Covers the document types the Loan Application
 * paper-form intake actually collects (valid ID, payslip, CB report — scans/photos and PDFs). */
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface UploadAttachmentInput {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  fileName: string;
  fileType: string;
  data: Buffer;
  documentCategory: AttachmentDocumentCategory | null;
  uploadedByUserId: string | null;
}

export class UploadAttachmentUseCase {
  constructor(
    private readonly deps: {
      attachmentRepository: IAttachmentRepository;
      fileStorage: IFileStorage;
    },
  ) {}

  async execute(input: UploadAttachmentInput): Promise<AttachmentRecord> {
    if (!ALLOWED_MIME_TYPES.has(input.fileType)) {
      throw new ValidationError(`Unsupported file type "${input.fileType}". Allowed: PDF, JPEG, PNG.`);
    }
    if (input.data.length === 0) {
      throw new ValidationError('The uploaded file is empty.');
    }
    if (input.data.length > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(`File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`);
    }

    // Server-generated key, never the client-supplied file name — the original name is preserved
    // only as display metadata (fileName column), never used to address storage (path traversal).
    const extension = path.extname(input.fileName).slice(0, 10);
    const storageKey = path.posix.join(
      input.ownerType.toLowerCase(),
      input.ownerId,
      `${crypto.randomUUID()}${extension}`,
    );

    await this.deps.fileStorage.save(storageKey, input.data);

    return this.deps.attachmentRepository.create({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.data.length,
      storageKey,
      documentCategory: input.documentCategory,
      uploadedByUserId: input.uploadedByUserId,
    });
  }
}
