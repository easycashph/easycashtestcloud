-- AlterEnum
ALTER TYPE "LoanAccountStatus" ADD VALUE 'CLOSED_COMPROMISED';

-- CreateTable
CREATE TABLE "loan_compromise_settlements" (
    "id" TEXT NOT NULL,
    "newLoanAccountId" TEXT NOT NULL,
    "totalPreviousBalance" DECIMAL(14,2) NOT NULL,
    "settlementAmount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT,
    "settledByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_compromise_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_compromise_settlement_items" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "oldLoanAccountId" TEXT NOT NULL,
    "previousCollectionsBalance" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "loan_compromise_settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_compromise_settlements_newLoanAccountId_key" ON "loan_compromise_settlements"("newLoanAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_compromise_settlement_items_oldLoanAccountId_key" ON "loan_compromise_settlement_items"("oldLoanAccountId");

-- AddForeignKey
ALTER TABLE "loan_compromise_settlements" ADD CONSTRAINT "loan_compromise_settlements_newLoanAccountId_fkey" FOREIGN KEY ("newLoanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_compromise_settlements" ADD CONSTRAINT "loan_compromise_settlements_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_compromise_settlement_items" ADD CONSTRAINT "loan_compromise_settlement_items_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "loan_compromise_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_compromise_settlement_items" ADD CONSTRAINT "loan_compromise_settlement_items_oldLoanAccountId_fkey" FOREIGN KEY ("oldLoanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
