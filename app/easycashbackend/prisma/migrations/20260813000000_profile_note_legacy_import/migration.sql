-- Allow migrated legacy notes (SDevTech "comments" collection) with no corresponding User record.
ALTER TABLE "profile_notes" ALTER COLUMN "authorUserId" DROP NOT NULL;

-- Idempotent-upsert key, same convention as every other migrated table.
ALTER TABLE "profile_notes" ADD COLUMN "legacyId" TEXT;
CREATE UNIQUE INDEX "profile_notes_legacyId_key" ON "profile_notes"("legacyId");
