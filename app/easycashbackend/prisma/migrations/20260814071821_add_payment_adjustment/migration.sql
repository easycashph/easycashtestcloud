-- CreateTable
CREATE TABLE "payment_adjustments" (
    "id" TEXT NOT NULL,
    "loanTransactionId" TEXT NOT NULL,
    "repaymentInstallmentId" TEXT NOT NULL,
    "previousPrincipalPaid" DECIMAL(14,2) NOT NULL,
    "previousInterestPaid" DECIMAL(14,2) NOT NULL,
    "previousFeesPaid" DECIMAL(14,2) NOT NULL,
    "previousPenaltyPaid" DECIMAL(14,2) NOT NULL,
    "newPrincipalPaid" DECIMAL(14,2) NOT NULL,
    "newInterestPaid" DECIMAL(14,2) NOT NULL,
    "newFeesPaid" DECIMAL(14,2) NOT NULL,
    "newPenaltyPaid" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_adjustments_loanTransactionId_idx" ON "payment_adjustments"("loanTransactionId");

-- CreateIndex
CREATE INDEX "payment_adjustments_repaymentInstallmentId_idx" ON "payment_adjustments"("repaymentInstallmentId");

-- AddForeignKey
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_loanTransactionId_fkey" FOREIGN KEY ("loanTransactionId") REFERENCES "loan_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_repaymentInstallmentId_fkey" FOREIGN KEY ("repaymentInstallmentId") REFERENCES "repayment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_adjustedByUserId_fkey" FOREIGN KEY ("adjustedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
