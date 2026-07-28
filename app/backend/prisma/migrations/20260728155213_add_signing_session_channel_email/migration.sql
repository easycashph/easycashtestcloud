-- AlterTable
ALTER TABLE "loan_signing_sessions" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'SMS',
ADD COLUMN     "email" TEXT;
