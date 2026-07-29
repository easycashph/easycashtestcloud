-- AlterTable
ALTER TABLE "repayment_schedules" ADD COLUMN     "feesOverrideAmount" DECIMAL(14,2),
ADD COLUMN     "feesOverrideAt" TIMESTAMP(3),
ADD COLUMN     "feesOverrideByUserId" TEXT,
ADD COLUMN     "feesOverrideReason" TEXT;

-- CreateTable
CREATE TABLE "fee_adjustments" (
    "id" TEXT NOT NULL,
    "repaymentInstallmentId" TEXT NOT NULL,
    "previousFeesAmount" DECIMAL(14,2) NOT NULL,
    "newFeesAmount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fee_adjustments_repaymentInstallmentId_idx" ON "fee_adjustments"("repaymentInstallmentId");

-- AddForeignKey
ALTER TABLE "repayment_schedules" ADD CONSTRAINT "repayment_schedules_feesOverrideByUserId_fkey" FOREIGN KEY ("feesOverrideByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_repaymentInstallmentId_fkey" FOREIGN KEY ("repaymentInstallmentId") REFERENCES "repayment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_adjustedByUserId_fkey" FOREIGN KEY ("adjustedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
