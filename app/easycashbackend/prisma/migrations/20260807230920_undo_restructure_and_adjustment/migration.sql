-- AlterEnum
ALTER TYPE "LoanAccountStatus" ADD VALUE 'CLOSED_UNDONE';

-- DropIndex
DROP INDEX "loan_adjustments_oldLoanAccountId_key";

-- DropIndex
DROP INDEX "loan_restructures_oldLoanAccountId_key";

-- AlterTable
ALTER TABLE "loan_adjustments" ADD COLUMN     "undoneAt" TIMESTAMP(3),
ADD COLUMN     "undoneByUserId" TEXT;

-- AlterTable
ALTER TABLE "loan_restructures" ADD COLUMN     "undoneAt" TIMESTAMP(3),
ADD COLUMN     "undoneByUserId" TEXT;

-- CreateIndex
CREATE INDEX "loan_adjustments_oldLoanAccountId_idx" ON "loan_adjustments"("oldLoanAccountId");

-- CreateIndex
CREATE INDEX "loan_restructures_oldLoanAccountId_idx" ON "loan_restructures"("oldLoanAccountId");

-- AddForeignKey
ALTER TABLE "loan_restructures" ADD CONSTRAINT "loan_restructures_undoneByUserId_fkey" FOREIGN KEY ("undoneByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_adjustments" ADD CONSTRAINT "loan_adjustments_undoneByUserId_fkey" FOREIGN KEY ("undoneByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
