export type BulkExportType = 'BORROWER_ATTACHMENTS' | 'LOAN_ACCOUNT_ATTACHMENTS' | 'DATABASE_DUMP';
export type BulkExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface BulkExportJob {
  id: string;
  exportType: BulkExportType;
  startDate: string;
  endDate: string;
  status: BulkExportStatus;
  recordCount: number | null;
  processedRecords: number | null;
  fileCount: number | null;
  resultFileSize: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}
