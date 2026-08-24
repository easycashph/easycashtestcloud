import { z } from 'zod';

export const bulkExportTypeSchema = z.enum(['BORROWER_ATTACHMENTS', 'LOAN_ACCOUNT_ATTACHMENTS']);

export const createBulkExportJobSchema = z.object({
  exportType: bulkExportTypeSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export type CreateBulkExportJobRequestBody = z.infer<typeof createBulkExportJobSchema>;
