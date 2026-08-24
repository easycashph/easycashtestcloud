import type { Readable } from 'node:stream';
import { ForbiddenError, NotFoundError, ValidationError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { IBulkExportJobRepository } from '../ports/IBulkExportJobRepository';

export interface DownloadBulkExportJobUseCaseDeps {
  bulkExportJobRepository: IBulkExportJobRepository;
  fileStorage: IFileStorage;
}

/** Streams a completed export's ZIP back to its requester (2026-08-24) - never buffers the whole
 * file, same streaming discipline as `ProcessBulkExportJobUseCase`'s write side. Scoped to the
 * requester who kicked the job off, not every MIS user - "My Exports" is a personal history, not a
 * shared company archive (not asked for; keep it narrow until requested). */
export class DownloadBulkExportJobUseCase {
  constructor(private readonly deps: DownloadBulkExportJobUseCaseDeps) {}

  async execute(jobId: string, requesterUserId: string): Promise<{ fileName: string; fileSize: number; stream: Readable }> {
    const job = await this.deps.bulkExportJobRepository.findById(jobId);
    if (!job) throw new NotFoundError('BulkExportJob', jobId);
    if (job.requestedByUserId !== requesterUserId) throw new ForbiddenError();
    if (job.status !== 'COMPLETED' || !job.resultStorageKey || job.resultFileSize === null) {
      throw new ValidationError('This export is not ready for download yet.');
    }

    const dateSuffix = job.createdAt.toISOString().slice(0, 10);
    const fileName =
      job.exportType === 'DATABASE_DUMP'
        ? `Database-Export-${dateSuffix}.zip`
        : `${job.exportType === 'BORROWER_ATTACHMENTS' ? 'Clients' : 'Loan-Accounts'}-Attachments-${dateSuffix}.zip`;
    return {
      fileName,
      fileSize: job.resultFileSize,
      stream: this.deps.fileStorage.createReadStream(job.resultStorageKey),
    };
  }
}
