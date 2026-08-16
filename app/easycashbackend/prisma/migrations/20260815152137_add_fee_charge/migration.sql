-- CreateTable
CREATE TABLE "fee_charges" (
    "id" TEXT NOT NULL,
    "repaymentInstallmentId" TEXT NOT NULL,
    "loanTransactionId" TEXT NOT NULL,
    "previousFeesAmount" DECIMAL(14,2) NOT NULL,
    "newFeesAmount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "chargedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_charges_repaymentInstallmentId_idx" ON "fee_charges"("repaymentInstallmentId");

-- CreateIndex
CREATE INDEX "fee_charges_loanTransactionId_idx" ON "fee_charges"("loanTransactionId");

-- AddForeignKey
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_repaymentInstallmentId_fkey" FOREIGN KEY ("repaymentInstallmentId") REFERENCES "repayment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_loanTransactionId_fkey" FOREIGN KEY ("loanTransactionId") REFERENCES "loan_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_chargedByUserId_fkey" FOREIGN KEY ("chargedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
