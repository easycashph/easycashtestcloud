import type { AttachmentRecord, IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import type { IFileStorage } from '@modules/document/application/ports/IFileStorage';
import { GetPortalProfilePhotoUseCase } from './GetPortalProfilePhotoUseCase';

export interface DownloadPortalProfilePhotoUseCaseDeps {
  attachmentRepository: IAttachmentRepository;
  fileStorage: IFileStorage;
}

/** Serves the client's own profile photo bytes for the portal frontend's `<img>` rendering
 * (fetched as a blob, same pattern as loan-application document downloads - a plain `<img src>`
 * can't attach the required Bearer auth header). Returns `null` rather than throwing when no
 * photo has been uploaded yet - not an error case, just "nothing to show". */
export class DownloadPortalProfilePhotoUseCase {
  constructor(private readonly deps: DownloadPortalProfilePhotoUseCaseDeps) {}

  async execute(portalAccountId: string): Promise<{ record: AttachmentRecord; data: Buffer } | null> {
    const getPortalProfilePhotoUseCase = new GetPortalProfilePhotoUseCase(this.deps);
    const record = await getPortalProfilePhotoUseCase.execute(portalAccountId);
    if (!record) return null;

    const data = await this.deps.fileStorage.read(record.storageKey);
    return { record, data };
  }
}
