-- Renames the "note" module to "profile-note" to disambiguate from the separate, coexisting
-- "loan-note" module (LoanNote/loan_notes - loan-account-only, MIS-deletable, audit-trailed).
-- This one is a simple, undeletable running log shared across Borrower/LoanAccount/
-- LoanApplication profiles, mirroring the existing ProfileActivityLog naming convention. Pure
-- rename, no data loss - existing rows keep their ids/content.
ALTER TYPE "NoteOwnerType" RENAME TO "ProfileNoteOwnerType";

ALTER TABLE "notes" RENAME TO "profile_notes";
ALTER TABLE "profile_notes" RENAME CONSTRAINT "notes_pkey" TO "profile_notes_pkey";
ALTER TABLE "profile_notes" RENAME CONSTRAINT "notes_authorUserId_fkey" TO "profile_notes_authorUserId_fkey";
ALTER INDEX "notes_ownerType_ownerId_idx" RENAME TO "profile_notes_ownerType_ownerId_idx";
