-- DropForeignKey
ALTER TABLE "loan_adjustments" DROP CONSTRAINT "loan_adjustments_undoneByUserId_fkey";

-- DropForeignKey
ALTER TABLE "loan_restructures" DROP CONSTRAINT "loan_restructures_undoneByUserId_fkey";

-- DropIndex
DROP INDEX "loan_adjustments_oldLoanAccountId_idx";

-- DropIndex
DROP INDEX "loan_restructures_oldLoanAccountId_idx";

-- AlterTable
ALTER TABLE "loan_adjustments" DROP COLUMN "undoneAt",
DROP COLUMN "undoneByUserId";

-- AlterTable
ALTER TABLE "loan_restructures" DROP COLUMN "undoneAt",
DROP COLUMN "undoneByUserId";

-- CreateIndex
CREATE UNIQUE INDEX "loan_adjustments_oldLoanAccountId_key" ON "loan_adjustments"("oldLoanAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_restructures_oldLoanAccountId_key" ON "loan_restructures"("oldLoanAccountId");
