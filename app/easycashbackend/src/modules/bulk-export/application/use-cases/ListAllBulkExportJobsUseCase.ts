import type { BulkExportJob } from '../../domain/BulkExportJob';
import type { IBulkExportJobRepository } from '../ports/IBulkExportJobRepository';
import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';

export interface ListAllBulkExportJobsUseCaseDeps {
  bulkExportJobRepository: IBulkExportJobRepository;
  userRepository: IUserRepository;
}

export interface BulkExportJobWithRequester {
  job: BulkExportJob;
  requestedByName: string | null;
}

/** Backs the "Export History" table (2026-09-15 user request) - every export requested by every
 * user, not just the current viewer's own (see DownloadBulkExportJobUseCase/
 * CancelBulkExportJobUseCase's doc comments: those stay scoped to the original requester, only
 * this listing widened). Resolves each distinct requester once rather than per job, since a
 * handful of MIS staff typically account for most rows. */
export class ListAllBulkExportJobsUseCase {
  constructor(private readonly deps: ListAllBulkExportJobsUseCaseDeps) {}

  async execute(): Promise<BulkExportJobWithRequester[]> {
    const jobs = await this.deps.bulkExportJobRepository.findMany();

    const uniqueRequesterIds = [...new Set(jobs.map((j) => j.requestedByUserId))];
    const requesters = await Promise.all(uniqueRequesterIds.map((id) => this.deps.userRepository.findById(id)));
    const nameByUserId = new Map<string, string>();
    uniqueRequesterIds.forEach((id, i) => {
      const user = requesters[i];
      if (user) nameByUserId.set(id, `${user.firstName} ${user.lastName}`.trim());
    });

    return jobs.map((job) => ({ job, requestedByName: nameByUserId.get(job.requestedByUserId) ?? null }));
  }
}
