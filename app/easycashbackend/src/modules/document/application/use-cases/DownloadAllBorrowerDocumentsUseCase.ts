import { NotFoundError } from '@shared/errors/DomainError';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import { buildUniqueZipEntryPath } from '@shared/application/buildUniqueZipEntryPath';
import type { IAttachmentRepository } from '../ports/IAttachmentRepository';
import type { IFileStorage } from '../ports/IFileStorage';
import { documentCategoryLabel } from '../documentCategoryLabel';

export interface ZipEntry {
  path: string;
  data: Buffer;
}

export interface DownloadAllBorrowerDocumentsUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
  attachmentRepository: IAttachmentRepository;
  fileStorage: IFileStorage;
}

/** MIS-only bulk export (2026-08-20 user request): every attachment on file for one client -
 * scanned IDs, payslips, proof of billing, photos, etc. - packaged into one ZIP, organized into a
 * subfolder per document category, instead of downloading each file one at a time. */
export class DownloadAllBorrowerDocumentsUseCase {
  constructor(private readonly deps: DownloadAllBorrowerDocumentsUseCaseDeps) {}

  async execute(borrowerId: string): Promise<{ zipFileName: string; entries: ZipEntry[] }> {
    const borrower = await this.deps.borrowerRepository.findById(borrowerId);
    if (!borrower) throw new NotFoundError('Borrower', borrowerId);

    const attachments = await this.deps.attachmentRepository.listByOwner('BORROWER', borrowerId);
    const usedPaths = new Set<string>();
    const entries: ZipEntry[] = [];
    for (const attachment of attachments) {
      // Some legacy-migrated rows carry a `legacy-unmigrated:...` placeholder `storageKey` with no
      // real file behind it (the original SDevTech file was never carried over) - skip rather than
      // fail the whole ZIP over one missing file; the other real attachments still deserve to reach
      // MIS. Same underlying gap the single-attachment download endpoint has always had.
      try {
        const data = await this.deps.fileStorage.read(attachment.storageKey);
        const path = buildUniqueZipEntryPath(usedPaths, documentCategoryLabel(attachment.documentCategory), attachment.fileName);
        entries.push({ path, data });
      } catch (error) {
        console.error(`[DownloadAllBorrowerDocumentsUseCase] skipping unreadable attachment ${attachment.id}`, error);
      }
    }

    const datedSuffix = new Date().toISOString().slice(0, 10);
    const zipFileName = `${borrower.name.lastName}_${borrower.name.firstName}-Documents-${datedSuffix}.zip`.replace(/\s+/g, '_');
    return { zipFileName, entries };
  }
}
