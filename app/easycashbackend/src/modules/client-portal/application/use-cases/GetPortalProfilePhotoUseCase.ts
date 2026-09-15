import type { AttachmentRecord, IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';

export interface GetPortalProfilePhotoUseCaseDeps {
  attachmentRepository: IAttachmentRepository;
}

/** Metadata-only lookup, shared by `GetPortalProfileUseCase` (the `hasProfilePhoto` flag) and
 * `DownloadPortalProfilePhotoUseCase` (which reads the file bytes once it has this record) - see
 * `UploadPortalProfilePhotoUseCase`'s own doc comment for why this is owned by PortalAccount
 * rather than a LoanApplication. */
export class GetPortalProfilePhotoUseCase {
  constructor(private readonly deps: GetPortalProfilePhotoUseCaseDeps) {}

  async execute(portalAccountId: string): Promise<AttachmentRecord | null> {
    const attachments = await this.deps.attachmentRepository.listByOwner('PORTAL_ACCOUNT', portalAccountId);
    const photos = attachments.filter((a) => a.documentCategory === 'PROFILE_PICTURE');
    if (photos.length === 0) return null;
    // Most recently uploaded wins - see UploadPortalProfilePhotoUseCase's doc comment on re-uploads.
    return photos.reduce((latest, current) => (current.uploadedAt > latest.uploadedAt ? current : latest));
  }
}
