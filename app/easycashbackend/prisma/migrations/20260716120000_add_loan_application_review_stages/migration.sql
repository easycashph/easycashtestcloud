-- AlterEnum
ALTER TYPE "LoanApplicationStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "LoanApplicationStatus" ADD VALUE 'PRE_APPROVAL';

-- CreateEnum
CREATE TYPE "CreditBureauResult" AS ENUM ('CLEAR', 'FLAGGED', 'NO_RECORD_FOUND');

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN "reviewStartedByUserId" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "reviewStartedAt" TIMESTAMP(3);
ALTER TABLE "loan_applications" ADD COLUMN "reviewReport" JSONB;
ALTER TABLE "loan_applications" ADD COLUMN "preApprovedByUserId" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "preApprovedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_reviewStartedByUserId_fkey"
  FOREIGN KEY ("reviewStartedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_preApprovedByUserId_fkey"
  FOREIGN KEY ("preApprovedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
