CREATE TYPE "SoaPenaltyMode" AS ENUM ('RECORDED', 'COMPUTED');

-- Existing statements were all produced by the staff-entered date range, i.e. COMPUTED.
ALTER TABLE "generated_statements_of_account"
  ADD COLUMN "penaltyMode" "SoaPenaltyMode" NOT NULL DEFAULT 'COMPUTED';
ALTER TABLE "generated_statements_of_account" ALTER COLUMN "penaltyMode" DROP DEFAULT;

-- RECORDED mode asks for no dates.
ALTER TABLE "generated_statements_of_account" ALTER COLUMN "penaltyFromDate" DROP NOT NULL;
ALTER TABLE "generated_statements_of_account" ALTER COLUMN "penaltyToDate" DROP NOT NULL;
