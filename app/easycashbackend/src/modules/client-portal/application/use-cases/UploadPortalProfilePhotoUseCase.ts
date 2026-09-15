import type { AttachmentRecord } from '@modules/document/application/ports/IAttachmentRepository';
import type { UploadAttachmentUseCase } from '@modules/document/application/use-cases/UploadAttachmentUseCase';

export interface UploadPortalProfilePhotoInput {
  portalAccountId: string;
  fileName: string;
  fileType: string;
  data: Buffer;
}

export interface UploadPortalProfilePhotoUseCaseDeps {
  uploadAttachmentUseCase: UploadAttachmentUseCase;
}

/**
 * Profile photo (2026-09-14 user request: "make profile picture mandatory"). Stored as an
 * Attachment owned directly by the PortalAccount (`ownerType=PORTAL_ACCOUNT`), independent of any
 * LoanApplication - unlike the existing PROFILE_PICTURE-on-LOAN_APPLICATION path
 * (`PortalAvatar.tsx`/`UploadPortalLoanApplicationDocumentUseCase`), which only exists once a
 * client has submitted an application. The first-login profile-completion gate runs before that
 * (right after signup), so a required photo needs somewhere to attach to that doesn't depend on
 * an application existing yet.
 *
 * Re-uploading simply creates a new attachment row - `GetPortalProfilePhotoUseCase` always reads
 * the most recently uploaded one, so the old one becomes an orphaned row rather than being
 * deleted. Acceptable here (small images, not worth the extra delete-old-file complexity for a
 * profile photo); revisit if storage volume ever becomes a concern.
 */
export class UploadPortalProfilePhotoUseCase {
  constructor(private readonly deps: UploadPortalProfilePhotoUseCaseDeps) {}

  async execute(input: UploadPortalProfilePhotoInput): Promise<AttachmentRecord> {
    return this.deps.uploadAttachmentUseCase.execute({
      ownerType: 'PORTAL_ACCOUNT',
      ownerId: input.portalAccountId,
      fileName: input.fileName,
      fileType: input.fileType,
      data: input.data,
      documentCategory: 'PROFILE_PICTURE',
      uploadedByUserId: null,
    });
  }
}
