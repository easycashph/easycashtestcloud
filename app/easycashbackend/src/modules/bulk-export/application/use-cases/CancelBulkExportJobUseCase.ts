import { ForbiddenError, NotFoundError, ValidationError } from '@shared/errors/DomainError';
import type { IBulkExportJobRepository } from '../ports/IBulkExportJobRepository';
import type { BulkExportCancellationRegistry } from '../../infrastructure/BulkExportCancellationRegistry';

export interface CancelBulkExportJobUseCaseDeps {
  bulkExportJobRepository: IBulkExportJobRepository;
  cancellationRegistry: BulkExportCancellationRegistry;
}

/**
 * Stops a job that's still PENDING or PROCESSING (2026-08-25, Cancel Export, user request).
 * Scoped to the requester who kicked the job off, same "personal history, not a shared archive"
 * narrowing `DownloadBulkExportJobUseCase` already applies.
 *
 * Two cases, because a PENDING job (created but `ProcessBulkExportJobUseCase.execute` hasn't
 * reached its first `await` yet - vanishingly brief, but real) has nothing registered in the
 * cancellation registry to signal:
 *   - PROCESSING: `cancellationRegistry.requestCancel` finds the running job's `AbortController`
 *     and aborts it - the job itself marks its own row CANCELLED once it observes the signal
 *     (see `ProcessBulkExportJobUseCase`), not this use case.
 *   - PENDING, registry has nothing yet: mark the row CANCELLED directly here. If the runner
 *     starts a heartbeat later anyway, it's still the source of truth for its own job and will
 *     immediately see the row is no longer runnable - out of scope until that race is ever real.
 */
export class CancelBulkExportJobUseCase {
  constructor(private readonly deps: CancelBulkExportJobUseCaseDeps) {}

  async execute(jobId: string, requesterUserId: string): Promise<void> {
    const job = await this.deps.bulkExportJobRepository.findById(jobId);
    if (!job) throw new NotFoundError('BulkExportJob', jobId);
    if (job.requestedByUserId !== requesterUserId) throw new ForbiddenError();
    if (!job.isCancellable) {
      throw new ValidationError('This export has already finished and cannot be cancelled.');
    }

    const signalled = this.deps.cancellationRegistry.requestCancel(jobId);
    if (!signalled) {
      job.markCancelled();
      await this.deps.bulkExportJobRepository.save(job);
    }
  }
}
