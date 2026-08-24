import type { TransactionContext } from '@shared/application/TransactionContext';
import type { BulkExportJob } from '../../domain/BulkExportJob';

export interface IBulkExportJobRepository {
  create(job: BulkExportJob, ctx?: TransactionContext): Promise<void>;
  save(job: BulkExportJob, ctx?: TransactionContext): Promise<void>;
  findById(id: string, ctx?: TransactionContext): Promise<BulkExportJob | null>;
  /** Newest first - backs the "My Exports" history page. */
  findManyByRequester(requestedByUserId: string, ctx?: TransactionContext): Promise<BulkExportJob[]>;
  /** Every job whose `resultStorageKey` is set and `completedAt` is older than `olderThan` -
   * `BulkExportCleanupScheduler.ts` deletes both the row and the file for each. */
  findCompletedOlderThan(olderThan: Date, ctx?: TransactionContext): Promise<BulkExportJob[]>;
  delete(id: string, ctx?: TransactionContext): Promise<void>;
}
