-- AlterTable
ALTER TABLE "portal_accounts" ADD COLUMN     "twoFactorChannel" TEXT,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT true;
