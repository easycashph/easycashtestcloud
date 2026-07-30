-- CreateEnum
CREATE TYPE "SigningPartyType" AS ENUM ('BORROWER', 'CO_BORROWER');

-- AlterTable
ALTER TABLE "document_templates" ADD COLUMN     "requiresBorrowerSignature" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requiresCoBorrowerSignature" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "loan_signing_sessions" ADD COLUMN     "coBorrowerId" TEXT,
ADD COLUMN     "partyType" "SigningPartyType" NOT NULL DEFAULT 'BORROWER';

-- AddForeignKey
ALTER TABLE "loan_signing_sessions" ADD CONSTRAINT "loan_signing_sessions_coBorrowerId_fkey" FOREIGN KEY ("coBorrowerId") REFERENCES "co_borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: which templates require which party's signature (2026-07-25 user-confirmed business rule
-- - see the .docx templates themselves for the corresponding [[SIGNATURE_ANCHOR]] /
-- [[SIGNATURE_ANCHOR_CO_BORROWER]] markers added in this same change). Every other template keeps
-- the column defaults (borrower=true, coBorrower=false).
UPDATE "document_templates" SET "requiresBorrowerSignature" = false, "requiresCoBorrowerSignature" = true WHERE "code" = 'DEED_OF_ASSIGNMENT_CO_BORROWER';
UPDATE "document_templates" SET "requiresCoBorrowerSignature" = true WHERE "code" IN ('LOAN_AGREEMENT_SEAFARER', 'LOAN_AGREEMENT_SALARY', 'SPECIAL_POWER_OF_ATTORNEY');
