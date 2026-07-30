-- AlterEnum
ALTER TYPE "LoanAccountStatus" ADD VALUE 'CLOSED_ADJUSTED';

-- CreateTable
CREATE TABLE "loan_adjustments" (
    "id" TEXT NOT NULL,
    "oldLoanAccountId" TEXT NOT NULL,
    "newLoanAccountId" TEXT NOT NULL,
    "previousFirstRepaymentDate" TIMESTAMP(3) NOT NULL,
    "newFirstRepaymentDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "adjustedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_adjustments_oldLoanAccountId_key" ON "loan_adjustments"("oldLoanAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_adjustments_newLoanAccountId_key" ON "loan_adjustments"("newLoanAccountId");

-- AddForeignKey
ALTER TABLE "loan_adjustments" ADD CONSTRAINT "loan_adjustments_oldLoanAccountId_fkey" FOREIGN KEY ("oldLoanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_adjustments" ADD CONSTRAINT "loan_adjustments_newLoanAccountId_fkey" FOREIGN KEY ("newLoanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_adjustments" ADD CONSTRAINT "loan_adjustments_adjustedByUserId_fkey" FOREIGN KEY ("adjustedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
