import type { BulkExportJob } from '../../domain/BulkExportJob';
import type { IBulkExportJobRepository } from '../ports/IBulkExportJobRepository';

export interface ListMyBulkExportJobsUseCaseDeps {
  bulkExportJobRepository: IBulkExportJobRepository;
}

/** Backs the "My Exports" history page (2026-08-24, user-confirmed) - so a completed export can
 * still be found and re-downloaded even if its Notification was already missed or cleared. */
export class ListMyBulkExportJobsUseCase {
  constructor(private readonly deps: ListMyBulkExportJobsUseCaseDeps) {}

  async execute(requestedByUserId: string): Promise<BulkExportJob[]> {
    return this.deps.bulkExportJobRepository.findManyByRequester(requestedByUserId);
  }
}
