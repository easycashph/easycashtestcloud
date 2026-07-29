-- AlterEnum
ALTER TYPE "LoanAccountStatus" ADD VALUE 'CLOSED_RESTRUCTURED';

-- CreateTable
CREATE TABLE "loan_restructures" (
    "id" TEXT NOT NULL,
    "oldLoanAccountId" TEXT NOT NULL,
    "newLoanAccountId" TEXT NOT NULL,
    "previousCollectionsBalance" DECIMAL(14,2) NOT NULL,
    "newPrincipalAmount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT,
    "restructuredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_restructures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_restructures_oldLoanAccountId_key" ON "loan_restructures"("oldLoanAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_restructures_newLoanAccountId_key" ON "loan_restructures"("newLoanAccountId");

-- AddForeignKey
ALTER TABLE "loan_restructures" ADD CONSTRAINT "loan_restructures_oldLoanAccountId_fkey" FOREIGN KEY ("oldLoanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_restructures" ADD CONSTRAINT "loan_restructures_newLoanAccountId_fkey" FOREIGN KEY ("newLoanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_restructures" ADD CONSTRAINT "loan_restructures_restructuredByUserId_fkey" FOREIGN KEY ("restructuredByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
