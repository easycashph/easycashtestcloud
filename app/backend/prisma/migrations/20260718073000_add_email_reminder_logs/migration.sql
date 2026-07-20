-- CreateEnum
CREATE TYPE "EmailReminderStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "email_reminder_logs" (
    "id" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "installmentId" TEXT,
    "triggerType" "ReminderTriggerType" NOT NULL,
    "triggerDate" TIMESTAMP(3) NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "EmailReminderStatus" NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_reminder_logs_loanAccountId_idx" ON "email_reminder_logs"("loanAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "email_reminder_logs_loanAccountId_triggerType_triggerDate_key" ON "email_reminder_logs"("loanAccountId", "triggerType", "triggerDate");

-- AddForeignKey
ALTER TABLE "email_reminder_logs" ADD CONSTRAINT "email_reminder_logs_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_reminder_logs" ADD CONSTRAINT "email_reminder_logs_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "repayment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
