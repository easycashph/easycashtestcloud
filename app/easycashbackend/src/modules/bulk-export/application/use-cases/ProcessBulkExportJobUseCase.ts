import { ZipArchive } from 'archiver';
import { logger } from '@shared/logger/logger';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import { buildUniqueZipEntryPath } from '@shared/application/buildUniqueZipEntryPath';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import { documentCategoryLabel } from '@modules/document/application/documentCategoryLabel';
import type { NotificationService } from '@modules/notification/application/NotificationService';
import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { IBulkExportJobRepository } from '../ports/IBulkExportJobRepository';

export interface ProcessBulkExportJobUseCaseDeps {
  bulkExportJobRepository: IBulkExportJobRepository;
  borrowerRepository: IBorrowerRepository;
  loanAccountRepository: ILoanAccountRepository;
  attachmentRepository: IAttachmentRepository;
  userRepository: IUserRepository;
  fileStorage: IFileStorage;
  notificationService: NotificationService;
}

/**
 * The actual background worker for `BulkExportJob` (2026-08-24, MIS bulk document export). Not a
 * queue consumer - there is no queue in this codebase (see `misPostRotationScheduler.ts`'s own doc
 * comment on why: avoiding a new paid Redis/queue dependency for a low-frequency, staff-driven
 * action). Invoked fire-and-forget from `CreateBulkExportJobUseCase` - `void processor.execute(jobId)`
 * - so the HTTP request returns immediately while this keeps running in the same Node process.
 *
 * Streams directly to disk (`fileStorage.createWriteStream`) via `archiver`'s `ZipArchive`, and
 * reads each source file as a stream too (`fileStorage.createReadStream`), never buffering an
 * entire attachment or the growing ZIP in memory - required at this scale (potentially thousands of
 * records, hundreds of MB to GB of attachments) where the single-record "Download All Documents"
 * feature's in-memory-Buffer approach (`DownloadAllBorrowerDocumentsUseCase` et al.) would not be
 * safe.
 *
 * Skips unreadable individual files (same `legacy-unmigrated:` placeholder-storageKey gap the
 * single-record feature already works around) rather than failing the whole job over one file.
 */
export class ProcessBulkExportJobUseCase {
  constructor(private readonly deps: ProcessBulkExportJobUseCaseDeps) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.deps.bulkExportJobRepository.findById(jobId);
    if (!job) {
      logger.error({ jobId }, '[ProcessBulkExportJobUseCase] job not found');
      return;
    }

    // Notification.branchId is a required FK - use the requester's own branch, not the (possibly
    // null, for a global MIS user) export-scope branchId filter on the job itself.
    const requester = await this.deps.userRepository.findById(job.requestedByUserId);
    const notifyBranchId = requester?.branchId ?? job.branchId;
    if (!notifyBranchId) {
      logger.error({ jobId }, '[ProcessBulkExportJobUseCase] could not resolve a branchId to notify on - aborting');
      return;
    }

    try {
      const records =
        job.exportType === 'BORROWER_ATTACHMENTS'
          ? await this.deps.borrowerRepository.findManyCreatedBetween(job.startDate, job.endDate, job.branchId ?? undefined)
          : (await this.deps.loanAccountRepository.findManyCreatedBetween(job.startDate, job.endDate, job.branchId ?? undefined)).map(
              (r) => ({ id: r.id, displayName: r.loanCode }),
            );

      job.markProcessing(records.length);
      await this.deps.bulkExportJobRepository.save(job);

      const resultStorageKey = `bulk-exports/${job.id}.zip`;
      const writeStream = this.deps.fileStorage.createWriteStream(resultStorageKey);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      const usedPaths = new Set<string>();
      let fileCount = 0;

      const archiveDone = new Promise<void>((resolvePromise, rejectPromise) => {
        writeStream.on('close', () => resolvePromise());
        writeStream.on('error', (err) => rejectPromise(err));
        archive.on('error', (err) => rejectPromise(err));
      });
      archive.pipe(writeStream);

      const ownerType = job.exportType === 'BORROWER_ATTACHMENTS' ? 'BORROWER' : 'LOAN_ACCOUNT';
      for (const record of records) {
        const attachments = await this.deps.attachmentRepository.listByOwner(ownerType, record.id);
        const recordFolder = `${record.displayName} (${record.id.slice(0, 8)})`.replace(/[\\/:*?"<>|]/g, '-');
        for (const attachment of attachments) {
          // Read each attachment fully into a Buffer (not `createReadStream`) - individual
          // attachments are capped at 10MB (small, safe to buffer one at a time; nothing here holds
          // more than one in memory simultaneously), and critically, `fileStorage.read()`'s promise
          // rejects synchronously-catchable on a missing file, unlike a Readable stream's 'error'
          // event, which - if `archive.append()` doesn't itself attach a listener before the file
          // open fails - is unhandled and crashes the whole Node process (confirmed: this exact
          // legacy-unmigrated-storageKey gap took down the server before this fix, not just this
          // one job). The growing ZIP itself still streams straight to disk below - that's the part
          // that actually must never be fully buffered.
          try {
            const data = await this.deps.fileStorage.read(attachment.storageKey);
            const path = buildUniqueZipEntryPath(
              usedPaths,
              `${recordFolder}/${documentCategoryLabel(attachment.documentCategory)}`,
              attachment.fileName,
            );
            archive.append(data, { name: path });
            fileCount += 1;
          } catch (error) {
            logger.error({ jobId, attachmentId: attachment.id, error }, '[ProcessBulkExportJobUseCase] skipping unreadable attachment');
          }
        }
      }

      await archive.finalize();
      await archiveDone;

      job.markCompleted({ resultStorageKey, resultFileSize: archive.pointer(), fileCount });
      await this.deps.bulkExportJobRepository.save(job);

      const label = job.exportType === 'BORROWER_ATTACHMENTS' ? 'client' : 'loan account';
      await this.deps.notificationService.notifyUser({
        userId: job.requestedByUserId,
        branchId: notifyBranchId,
        type: 'BULK_EXPORT_READY',
        title: 'Bulk document export ready',
        body: `Your ${label} attachment export (${records.length} records, ${fileCount} files) is ready to download.`,
        entityType: 'BulkExportJob',
        entityId: job.id,
      });
    } catch (error) {
      logger.error({ jobId, error }, '[ProcessBulkExportJobUseCase] job failed');
      job.markFailed(error instanceof Error ? error.message : 'Unknown error');
      await this.deps.bulkExportJobRepository.save(job);
      await this.deps.notificationService.notifyUser({
        userId: job.requestedByUserId,
        branchId: notifyBranchId,
        type: 'BULK_EXPORT_READY',
        title: 'Bulk document export failed',
        body: 'Something went wrong while preparing your export. Please try again.',
        entityType: 'BulkExportJob',
        entityId: job.id,
      });
    }
  }
}
