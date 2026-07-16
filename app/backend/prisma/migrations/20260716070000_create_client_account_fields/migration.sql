-- AlterTable
ALTER TABLE "borrowers" ADD COLUMN "suffix" TEXT;
ALTER TABLE "borrowers" ADD COLUMN "facebookLink" TEXT;

-- AlterTable
ALTER TABLE "borrower_income_details" ADD COLUMN "monthsEmployed" INTEGER;

-- AlterTable (ADR-015 resolved: CoBorrower belongs to Borrower directly)
ALTER TABLE "co_borrowers" ADD COLUMN "borrowerId" TEXT;

-- CreateIndex
CREATE INDEX "co_borrowers_borrowerId_idx" ON "co_borrowers"("borrowerId");

-- AddForeignKey
ALTER TABLE "co_borrowers" ADD CONSTRAINT "co_borrowers_borrowerId_fkey"
  FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
