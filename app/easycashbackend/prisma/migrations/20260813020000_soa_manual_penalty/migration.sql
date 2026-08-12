ALTER TYPE "SoaPenaltyMode" ADD VALUE 'MANUAL';

ALTER TABLE "generated_statements_of_account" ADD COLUMN "penaltyManualReason" TEXT;
