import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { BulkExportJob, type BulkExportJobProps } from '../domain/BulkExportJob';
import type { IBulkExportJobRepository } from '../application/ports/IBulkExportJobRepository';

type BulkExportJobRow = Prisma.BulkExportJobGetPayload<Record<string, never>>;

function toDomain(row: BulkExportJobRow): BulkExportJob {
  const props: BulkExportJobProps = {
    id: row.id,
    requestedByUserId: row.requestedByUserId,
    branchId: row.branchId,
    exportType: row.exportType,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    recordCount: row.recordCount,
    processedRecords: row.processedRecords,
    fileCount: row.fileCount,
    resultStorageKey: row.resultStorageKey,
    resultFileSize: row.resultFileSize,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
  return BulkExportJob.reconstitute(props);
}

export class PrismaBulkExportJobRepository implements IBulkExportJobRepository {
  async create(job: BulkExportJob, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.bulkExportJob.create({
      data: {
        id: job.id,
        requestedByUserId: job.requestedByUserId,
        branchId: job.branchId,
        exportType: job.exportType,
        startDate: job.startDate,
        endDate: job.endDate,
        status: job.status,
        createdAt: job.createdAt,
      },
    });
  }

  async save(job: BulkExportJob, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.bulkExportJob.update({
      where: { id: job.id },
      data: {
        status: job.status,
        recordCount: job.recordCount,
        processedRecords: job.processedRecords,
        fileCount: job.fileCount,
        resultStorageKey: job.resultStorageKey,
        resultFileSize: job.resultFileSize,
        errorMessage: job.errorMessage,
        completedAt: job.completedAt,
      },
    });
  }

  async findById(id: string, ctx?: TransactionContext): Promise<BulkExportJob | null> {
    const client = resolveClient(ctx);
    const row = await client.bulkExportJob.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findMany(ctx?: TransactionContext): Promise<BulkExportJob[]> {
    const client = resolveClient(ctx);
    const rows = await client.bulkExportJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toDomain);
  }

  async findCompletedOlderThan(olderThan: Date, ctx?: TransactionContext): Promise<BulkExportJob[]> {
    const client = resolveClient(ctx);
    const rows = await client.bulkExportJob.findMany({
      where: { status: 'COMPLETED', completedAt: { lt: olderThan }, resultStorageKey: { not: null } },
    });
    return rows.map(toDomain);
  }

  async delete(id: string, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.bulkExportJob.delete({ where: { id } });
  }
}
