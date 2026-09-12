-- CreateEnum
CREATE TYPE "LoanApplicationRiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "dtiPercent" DECIMAL(6,2),
ADD COLUMN     "riskTier" "LoanApplicationRiskTier";
