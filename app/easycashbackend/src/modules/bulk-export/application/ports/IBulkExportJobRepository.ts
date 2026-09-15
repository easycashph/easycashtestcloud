import type { TransactionContext } from '@shared/application/TransactionContext';
import type { BulkExportJob } from '../../domain/BulkExportJob';

export interface IBulkExportJobRepository {
  create(job: BulkExportJob, ctx?: TransactionContext): Promise<void>;
  save(job: BulkExportJob, ctx?: TransactionContext): Promise<void>;
  findById(id: string, ctx?: TransactionContext): Promise<BulkExportJob | null>;
  /** Newest first, every requester - backs the shared "Export History" table (2026-09-15 user
   * request: show who exported what, not just the current viewer's own jobs). */
  findMany(ctx?: TransactionContext): Promise<BulkExportJob[]>;
  /** Every job whose `resultStorageKey` is set and `completedAt` is older than `olderThan` -
   * `BulkExportCleanupScheduler.ts` deletes both the row and the file for each. */
  findCompletedOlderThan(olderThan: Date, ctx?: TransactionContext): Promise<BulkExportJob[]>;
  delete(id: string, ctx?: TransactionContext): Promise<void>;
}
