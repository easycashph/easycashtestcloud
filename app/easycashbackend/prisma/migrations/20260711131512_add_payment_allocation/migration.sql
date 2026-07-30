-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "loanTransactionId" TEXT NOT NULL,
    "repaymentInstallmentId" TEXT NOT NULL,
    "principalApplied" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interestApplied" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "feesApplied" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "penaltyApplied" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_allocations_loanTransactionId_idx" ON "payment_allocations"("loanTransactionId");

-- CreateIndex
CREATE INDEX "payment_allocations_repaymentInstallmentId_idx" ON "payment_allocations"("repaymentInstallmentId");

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_loanTransactionId_fkey" FOREIGN KEY ("loanTransactionId") REFERENCES "loan_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_repaymentInstallmentId_fkey" FOREIGN KEY ("repaymentInstallmentId") REFERENCES "repayment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
