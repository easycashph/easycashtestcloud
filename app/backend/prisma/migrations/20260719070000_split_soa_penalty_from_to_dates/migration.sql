-- Split penaltyAsOfDate into penaltyFromDate + penaltyToDate (2026-07-19, user request).
-- Backfills existing rows from the old column before dropping it, rather than losing data.
ALTER TABLE "generated_statements_of_account" ADD COLUMN "penaltyFromDate" DATE;
ALTER TABLE "generated_statements_of_account" ADD COLUMN "penaltyToDate" DATE;

UPDATE "generated_statements_of_account"
SET "penaltyFromDate" = "penaltyAsOfDate",
    "penaltyToDate" = "penaltyAsOfDate";

ALTER TABLE "generated_statements_of_account" ALTER COLUMN "penaltyFromDate" SET NOT NULL;
ALTER TABLE "generated_statements_of_account" ALTER COLUMN "penaltyToDate" SET NOT NULL;
ALTER TABLE "generated_statements_of_account" DROP COLUMN "penaltyAsOfDate";
