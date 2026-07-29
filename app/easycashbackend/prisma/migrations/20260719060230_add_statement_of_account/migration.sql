-- DropForeignKey
ALTER TABLE "email_reminder_logs" DROP CONSTRAINT "email_reminder_logs_installmentId_fkey";

-- DropForeignKey
ALTER TABLE "sms_reminder_logs" DROP CONSTRAINT "sms_reminder_logs_installmentId_fkey";

-- CreateTable
CREATE TABLE "generated_statements_of_account" (
    "id" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "currentAmortizationDue" DECIMAL(14,2) NOT NULL,
    "pastDuePrincipal" DECIMAL(14,2) NOT NULL,
    "pastDueInterest" DECIMAL(14,2) NOT NULL,
    "pastDuePenalty" DECIMAL(14,2) NOT NULL,
    "totalPastDue" DECIMAL(14,2) NOT NULL,
    "accruedInterest" DECIMAL(14,2) NOT NULL,
    "collectionFee" DECIMAL(14,2) NOT NULL,
    "otherFee" DECIMAL(14,2) NOT NULL,
    "totalAmountDue" DECIMAL(14,2) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_statements_of_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_statements_of_account_loanAccountId_idx" ON "generated_statements_of_account"("loanAccountId");

-- AddForeignKey
ALTER TABLE "generated_statements_of_account" ADD CONSTRAINT "generated_statements_of_account_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_statements_of_account" ADD CONSTRAINT "generated_statements_of_account_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_reminder_logs" ADD CONSTRAINT "sms_reminder_logs_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "repayment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_reminder_logs" ADD CONSTRAINT "email_reminder_logs_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "repayment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
