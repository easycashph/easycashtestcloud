-- AlterEnum: LoanApplicationStatus PENDING_REVIEW/APPROVED/DECLINED -> PREAPPROVED/PREDECLINED/APPROVED/DECLINED
-- Existing PENDING_REVIEW rows (dev/test data only) are data-migrated to PREAPPROVED as part of the
-- cast itself (business-directed, explicit backfill — not a silent behavior change).
BEGIN;
CREATE TYPE "LoanApplicationStatus_new" AS ENUM ('PREAPPROVED', 'PREDECLINED', 'APPROVED', 'DECLINED');
ALTER TABLE "loan_applications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "loan_applications" ALTER COLUMN "status" TYPE "LoanApplicationStatus_new" USING (
  CASE WHEN "status"::text = 'PENDING_REVIEW' THEN 'PREAPPROVED' ELSE "status"::text END
)::"LoanApplicationStatus_new";
ALTER TYPE "LoanApplicationStatus" RENAME TO "LoanApplicationStatus_old";
ALTER TYPE "LoanApplicationStatus_new" RENAME TO "LoanApplicationStatus";
DROP TYPE "LoanApplicationStatus_old";
ALTER TABLE "loan_applications" ALTER COLUMN "status" SET DEFAULT 'PREDECLINED';
COMMIT;

-- AlterTable: Branch gets an address + geocoded coordinates (used by the loan-application distance rule)
ALTER TABLE "branches" ADD COLUMN     "address" TEXT,
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6);

-- AlterTable: drop the now-redundant "reviewed" inbox flag, add cached distance-to-branch
ALTER TABLE "loan_applications" DROP COLUMN "reviewState",
ADD COLUMN     "distanceFromBranchKm" DECIMAL(6,2);

-- DropEnum
DROP TYPE "LoanApplicationReviewState";
