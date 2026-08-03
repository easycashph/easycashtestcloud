-- AlterTable
ALTER TABLE "portal_accounts" ADD COLUMN     "dependants" JSONB,
ADD COLUMN     "officeAddress" TEXT,
ADD COLUMN     "reference1Mobile" TEXT,
ADD COLUMN     "reference1Name" TEXT,
ADD COLUMN     "reference2Mobile" TEXT,
ADD COLUMN     "reference2Name" TEXT,
ADD COLUMN     "sssNumber" TEXT,
ADD COLUMN     "tinNumber" TEXT;
