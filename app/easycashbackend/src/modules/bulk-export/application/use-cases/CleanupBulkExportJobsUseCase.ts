import { logger } from '@shared/logger/logger';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { IBulkExportJobRepository } from '../ports/IBulkExportJobRepository';

export interface CleanupBulkExportJobsUseCaseDeps {
  bulkExportJobRepository: IBulkExportJobRepository;
  fileStorage: IFileStorage;
}

/** 7-day retention for completed export ZIPs (2026-08-24, user-confirmed) - same window the remote
 * Postgres backup script already prunes to (`scripts/backup-remote-postgres.ps1`). Called daily by
 * `BulkExportCleanupScheduler.ts`. Deletes the job row too, not just the file - a stale row pointing
 * at a deleted file would otherwise 404 confusingly if someone revisits "My Exports" later. */
export class CleanupBulkExportJobsUseCase {
  constructor(private readonly deps: CleanupBulkExportJobsUseCaseDeps) {}

  async execute(retentionDays = 7): Promise<void> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const staleJobs = await this.deps.bulkExportJobRepository.findCompletedOlderThan(cutoff);

    for (const job of staleJobs) {
      try {
        if (job.resultStorageKey) {
          await this.deps.fileStorage.delete(job.resultStorageKey);
        }
        await this.deps.bulkExportJobRepository.delete(job.id);
      } catch (error) {
        logger.error({ jobId: job.id, error }, '[CleanupBulkExportJobsUseCase] failed to clean up job');
      }
    }
  }
}
