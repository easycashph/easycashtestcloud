-- CreateEnum
CREATE TYPE "ReminderTriggerType" AS ENUM ('FIVE_DAYS_BEFORE', 'THREE_DAYS_BEFORE', 'ONE_DAY_BEFORE', 'DUE_DATE', 'PAST_DUE_WEEKLY');

-- DropForeignKey
ALTER TABLE "sms_reminder_logs" DROP CONSTRAINT "sms_reminder_logs_installmentId_fkey";

-- DropIndex
DROP INDEX "sms_reminder_logs_installmentId_key";

-- AlterTable: installmentId is nullable now (PAST_DUE_WEEKLY sums across every overdue
-- installment, not one) - table is empty in every environment this feature has run in (never
-- enabled for real sends), so no backfill is needed for the two new NOT NULL columns below.
ALTER TABLE "sms_reminder_logs"
  ALTER COLUMN "installmentId" DROP NOT NULL,
  ADD COLUMN "triggerType" "ReminderTriggerType" NOT NULL,
  ADD COLUMN "triggerDate" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "sms_reminder_logs_installmentId_idx" ON "sms_reminder_logs"("installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_reminder_logs_loanAccountId_triggerType_triggerDate_key" ON "sms_reminder_logs"("loanAccountId", "triggerType", "triggerDate");

-- AddForeignKey
ALTER TABLE "sms_reminder_logs" ADD CONSTRAINT "sms_reminder_logs_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "repayment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
