-- CreateEnum
CREATE TYPE "SmsReminderStatus" AS ENUM ('SENT', 'DELIVERED', 'UNDELIVERED', 'REJECTED', 'FAILED');

-- AlterTable
ALTER TABLE "borrowers" ADD COLUMN     "smsRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "sms_reminder_logs" (
    "id" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SmsReminderStatus" NOT NULL DEFAULT 'SENT',
    "providerTransId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "sms_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sms_reminder_logs_installmentId_key" ON "sms_reminder_logs"("installmentId");

-- CreateIndex
CREATE INDEX "sms_reminder_logs_loanAccountId_idx" ON "sms_reminder_logs"("loanAccountId");

-- CreateIndex
CREATE INDEX "sms_reminder_logs_providerTransId_idx" ON "sms_reminder_logs"("providerTransId");

-- AddForeignKey
ALTER TABLE "sms_reminder_logs" ADD CONSTRAINT "sms_reminder_logs_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_reminder_logs" ADD CONSTRAINT "sms_reminder_logs_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "repayment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
