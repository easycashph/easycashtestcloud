import type { BulkExportJob } from '../../../domain/BulkExportJob';

export function presentBulkExportJob(job: BulkExportJob) {
  return {
    id: job.id,
    exportType: job.exportType,
    startDate: job.startDate.toISOString(),
    endDate: job.endDate.toISOString(),
    status: job.status,
    recordCount: job.recordCount,
    processedRecords: job.processedRecords,
    fileCount: job.fileCount,
    resultFileSize: job.resultFileSize,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}
