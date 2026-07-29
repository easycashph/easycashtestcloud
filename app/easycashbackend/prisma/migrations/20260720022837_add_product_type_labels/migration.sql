-- DropForeignKey
ALTER TABLE "email_reminder_logs" DROP CONSTRAINT "email_reminder_logs_installmentId_fkey";

-- DropForeignKey
ALTER TABLE "sms_reminder_logs" DROP CONSTRAINT "sms_reminder_logs_installmentId_fkey";

-- CreateTable
CREATE TABLE "product_type_labels" (
    "id" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_type_labels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_type_labels_canonicalKey_key" ON "product_type_labels"("canonicalKey");

-- AddForeignKey
ALTER TABLE "sms_reminder_logs" ADD CONSTRAINT "sms_reminder_logs_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "repayment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_reminder_logs" ADD CONSTRAINT "email_reminder_logs_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "repayment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
