import { ValidationError } from '@shared/errors/DomainError';
import { BulkExportJob, type BulkExportType } from '../../domain/BulkExportJob';
import type { IBulkExportJobRepository } from '../ports/IBulkExportJobRepository';
import type { ProcessBulkExportJobUseCase } from './ProcessBulkExportJobUseCase';

export interface CreateBulkExportJobUseCaseDeps {
  bulkExportJobRepository: IBulkExportJobRepository;
  processBulkExportJobUseCase: ProcessBulkExportJobUseCase;
}

export interface CreateBulkExportJobInput {
  requestedByUserId: string;
  /** The requester's own branch scope (H-1: undefined for a global caller, omitting the filter
   * entirely - never trust a client-supplied branchId here, same discipline as every other write). */
  branchId: string | undefined;
  exportType: BulkExportType;
  startDate: Date;
  endDate: Date;
}

/** MIS bulk document export (2026-08-24 user request): validates the requested date range, creates
 * the job row as PENDING, then kicks off `ProcessBulkExportJobUseCase` fire-and-forget (not
 * awaited) so the HTTP response returns immediately - the actual export can take minutes for a wide
 * date range. */
export class CreateBulkExportJobUseCase {
  constructor(private readonly deps: CreateBulkExportJobUseCaseDeps) {}

  async execute(input: CreateBulkExportJobInput): Promise<BulkExportJob> {
    if (input.startDate.getTime() > input.endDate.getTime()) {
      throw new ValidationError('Start date must be on or before the end date.');
    }

    const job = BulkExportJob.create({
      requestedByUserId: input.requestedByUserId,
      branchId: input.branchId ?? null,
      exportType: input.exportType,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    await this.deps.bulkExportJobRepository.create(job);

    void this.deps.processBulkExportJobUseCase.execute(job.id);

    return job;
  }
}
