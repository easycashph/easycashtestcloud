-- CreateEnum
CREATE TYPE "BulkExportType" AS ENUM ('BORROWER_ATTACHMENTS', 'LOAN_ACCOUNT_ATTACHMENTS');

-- CreateEnum
CREATE TYPE "BulkExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BULK_EXPORT_READY';

-- CreateTable
CREATE TABLE "bulk_export_jobs" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "branchId" TEXT,
    "exportType" "BulkExportType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "BulkExportStatus" NOT NULL DEFAULT 'PENDING',
    "recordCount" INTEGER,
    "fileCount" INTEGER,
    "resultStorageKey" TEXT,
    "resultFileSize" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "bulk_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulk_export_jobs_requestedByUserId_createdAt_idx" ON "bulk_export_jobs"("requestedByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "bulk_export_jobs" ADD CONSTRAINT "bulk_export_jobs_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_export_jobs" ADD CONSTRAINT "bulk_export_jobs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
