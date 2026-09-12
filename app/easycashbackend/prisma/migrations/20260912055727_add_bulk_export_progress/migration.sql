-- Add processedRecords progress tracking to BulkExportJob (2026-09-12, progress display feature)
ALTER TABLE "bulk_export_jobs" ADD COLUMN "processedRecords" INTEGER;
