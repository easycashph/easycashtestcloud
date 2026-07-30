-- AlterTable
ALTER TABLE "repayment_schedules" ADD COLUMN     "penaltyOverrideAmount" DECIMAL(14,2),
ADD COLUMN     "penaltyOverrideAt" TIMESTAMP(3),
ADD COLUMN     "penaltyOverrideByUserId" TEXT,
ADD COLUMN     "penaltyOverrideReason" TEXT;

-- CreateTable
CREATE TABLE "penalty_reductions" (
    "id" TEXT NOT NULL,
    "repaymentInstallmentId" TEXT NOT NULL,
    "previousPenaltyAmount" DECIMAL(14,2) NOT NULL,
    "newPenaltyAmount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "reducedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_reductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "penalty_reductions_repaymentInstallmentId_idx" ON "penalty_reductions"("repaymentInstallmentId");

-- AddForeignKey
ALTER TABLE "repayment_schedules" ADD CONSTRAINT "repayment_schedules_penaltyOverrideByUserId_fkey" FOREIGN KEY ("penaltyOverrideByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_reductions" ADD CONSTRAINT "penalty_reductions_repaymentInstallmentId_fkey" FOREIGN KEY ("repaymentInstallmentId") REFERENCES "repayment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_reductions" ADD CONSTRAINT "penalty_reductions_reducedByUserId_fkey" FOREIGN KEY ("reducedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
