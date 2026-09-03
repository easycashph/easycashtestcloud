-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LOAN_MATURED';
ALTER TYPE "NotificationType" ADD VALUE 'LOAN_FIRST_AMORTIZATION_DUE_TODAY';
ALTER TYPE "NotificationType" ADD VALUE 'LOAN_RESTRUCTURED';
ALTER TYPE "NotificationType" ADD VALUE 'LOAN_RESCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'LOAN_RECOVERED';
ALTER TYPE "NotificationType" ADD VALUE 'LOAN_CLOSED';
ALTER TYPE "NotificationType" ADD VALUE 'PORTAL_CHAT_MESSAGE';
