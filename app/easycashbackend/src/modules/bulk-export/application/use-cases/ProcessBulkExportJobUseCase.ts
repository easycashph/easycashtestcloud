import { spawn } from 'node:child_process';
import { ZipArchive } from 'archiver';
import { logger } from '@shared/logger/logger';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import { buildUniqueZipEntryPath } from '@shared/application/buildUniqueZipEntryPath';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import { documentCategoryLabel } from '@modules/document/application/documentCategoryLabel';
import { resolveAttachmentFileName } from '@modules/document/application/resolveAttachmentFileName';
import type { NotificationService } from '@modules/notification/application/NotificationService';
import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { BulkExportJob } from '../../domain/BulkExportJob';
import type { IBulkExportJobRepository } from '../ports/IBulkExportJobRepository';

export interface ProcessBulkExportJobUseCaseDeps {
  bulkExportJobRepository: IBulkExportJobRepository;
  borrowerRepository: IBorrowerRepository;
  loanAccountRepository: ILoanAccountRepository;
  attachmentRepository: IAttachmentRepository;
  userRepository: IUserRepository;
  fileStorage: IFileStorage;
  notificationService: NotificationService;
  /** Passed straight to `pg_dump` as its connection string (2026-08-24, MIS "Export Database"
   * feature) - the same `DATABASE_URL` the app itself connects with. `pg_dump` must be on PATH
   * (see `backend.Dockerfile`'s `postgresql16-client` package). */
  databaseUrl: string;
}

const EXPORT_TYPE_LABEL: Record<BulkExportJob['exportType'], string> = {
  BORROWER_ATTACHMENTS: 'client attachment',
  LOAN_ACCOUNT_ATTACHMENTS: 'loan account attachment',
  DATABASE_DUMP: 'database',
};

/**
 * The actual background worker for `BulkExportJob` (2026-08-24, MIS bulk document export + database
 * export). Not a queue consumer - there is no queue in this codebase (see `misPostRotationScheduler
 * .ts`'s own doc comment on why: avoiding a new paid Redis/queue dependency for a low-frequency,
 * staff-driven action). Invoked fire-and-forget from `CreateBulkExportJobUseCase` -
 * `void processor.execute(jobId)` - so the HTTP request returns immediately while this keeps
 * running in the same Node process.
 *
 * Streams directly to disk (`fileStorage.createWriteStream`) via `archiver`'s `ZipArchive`, never
 * buffering the whole growing ZIP in memory - required at this scale (potentially thousands of
 * records/hundreds of MB to GB of attachments, or a whole production database dump).
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
      const { recordCount, fileCount } =
        job.exportType === 'DATABASE_DUMP' ? await this.runDatabaseDump(job) : await this.runAttachmentExport(job);

      await this.deps.notificationService.notifyUser({
        userId: job.requestedByUserId,
        branchId: notifyBranchId,
        type: 'BULK_EXPORT_READY',
        title: 'Export ready',
        body:
          job.exportType === 'DATABASE_DUMP'
            ? 'Your database export is ready to download.'
            : `Your ${EXPORT_TYPE_LABEL[job.exportType]} export (${recordCount} records, ${fileCount} files) is ready to download.`,
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
        title: 'Export failed',
        body: `Something went wrong while preparing your ${EXPORT_TYPE_LABEL[job.exportType]} export. Please try again.`,
        entityType: 'BulkExportJob',
        entityId: job.id,
      });
    }
  }

  private async runAttachmentExport(job: BulkExportJob): Promise<{ recordCount: number; fileCount: number }> {
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
    // Loan accounts: `displayName` is the loan code, already unique on its own - no disambiguator
    // needed. Borrowers: two different clients can share the exact same name, so track how many
    // times each name has been seen and only append a plain " (2)", " (3)", ... the same way
    // buildUniqueZipEntryPath resolves a same-name file collision - readable by default (just the
    // name), instead of a permanent, always-on random ID fragment on every folder regardless of
    // whether a collision could even happen (confirmed 2026-08-25: MIS found the ID fragment
    // confusing on an already-unique loan code folder).
    const folderNameOccurrences = new Map<string, number>();
    for (const record of records) {
      const attachments = await this.deps.attachmentRepository.listByOwner(ownerType, record.id);
      let recordFolder = record.displayName;
      if (job.exportType === 'BORROWER_ATTACHMENTS') {
        const seenCount = (folderNameOccurrences.get(record.displayName) ?? 0) + 1;
        folderNameOccurrences.set(record.displayName, seenCount);
        recordFolder = seenCount > 1 ? `${record.displayName} (${seenCount})` : record.displayName;
      }
      recordFolder = recordFolder.replace(/[\\/:*?"<>|]/g, '-');
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
            resolveAttachmentFileName(attachment.fileName, attachment.fileType),
          );
          archive.append(data, { name: path });
          fileCount += 1;
        } catch (error) {
          logger.error({ jobId: job.id, attachmentId: attachment.id, error }, '[ProcessBulkExportJobUseCase] skipping unreadable attachment');
        }
      }
    }

    await archive.finalize();
    await archiveDone;

    job.markCompleted({ resultStorageKey, resultFileSize: archive.pointer(), fileCount });
    await this.deps.bulkExportJobRepository.save(job);

    return { recordCount: records.length, fileCount };
  }

  private async runDatabaseDump(job: BulkExportJob): Promise<{ recordCount: number; fileCount: number }> {
    job.markProcessing(1);
    await this.deps.bulkExportJobRepository.save(job);

    const resultStorageKey = `bulk-exports/${job.id}.zip`;
    const writeStream = this.deps.fileStorage.createWriteStream(resultStorageKey);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    const archiveDone = new Promise<void>((resolvePromise, rejectPromise) => {
      writeStream.on('close', () => resolvePromise());
      writeStream.on('error', (err) => rejectPromise(err));
      archive.on('error', (err) => rejectPromise(err));
    });
    archive.pipe(writeStream);

    const dumpFileName = `easycash-database-${job.createdAt.toISOString().slice(0, 10)}.dump`;
    // Prisma's DATABASE_URL carries a `?schema=...` query param pg_dump's own URI parser rejects
    // outright ("invalid URI query parameter") - strip it and pass the schema via pg_dump's own
    // `-n` flag instead (confirmed via live testing: without this fix, every database export job
    // failed immediately with that parse error).
    const connectionUrl = new URL(this.deps.databaseUrl);
    const schema = connectionUrl.searchParams.get('schema');
    connectionUrl.searchParams.delete('schema');
    const pgDumpArgs = [connectionUrl.toString(), '-F', 'c', ...(schema ? ['-n', schema] : [])];
    const pgDump = spawn('pg_dump', pgDumpArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderrOutput = '';
    pgDump.stderr.on('data', (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });
    // Same unhandled-'error'-event crash risk as a missing attachment file (see
    // runAttachmentExport's own doc comment) - attach a listener before archiver reads from it, so
    // a broken pipe/pg_dump crash logs and fails this job instead of taking down the whole process.
    pgDump.stdout.on('error', (err) => logger.error({ jobId: job.id, err }, '[ProcessBulkExportJobUseCase] pg_dump stdout error'));
    archive.append(pgDump.stdout, { name: dumpFileName });

    const dumpExit = new Promise<void>((resolvePromise, rejectPromise) => {
      pgDump.on('error', (err) => rejectPromise(err)); // e.g. pg_dump binary missing
      pgDump.on('close', (code) => {
        if (code === 0) resolvePromise();
        else rejectPromise(new Error(`pg_dump exited with code ${code}: ${stderrOutput.slice(0, 500)}`));
      });
    });

    await Promise.all([dumpExit, archive.finalize().then(() => archiveDone)]);

    job.markCompleted({ resultStorageKey, resultFileSize: archive.pointer(), fileCount: 1 });
    await this.deps.bulkExportJobRepository.save(job);

    return { recordCount: 1, fileCount: 1 };
  }
}
