-- Free-text notes attached to a Borrower/LoanAccount/LoanApplication, same polymorphic
-- ownerType/ownerId shape as "attachments". Replaces the in-browser-only mock Notes panel on
-- the Loan Account Detail page with real, persisted data.
CREATE TYPE "NoteOwnerType" AS ENUM ('BORROWER', 'LOAN_ACCOUNT', 'LOAN_APPLICATION');

CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "ownerType" "NoteOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notes_ownerType_ownerId_idx" ON "notes"("ownerType", "ownerId");

ALTER TABLE "notes" ADD CONSTRAINT "notes_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
