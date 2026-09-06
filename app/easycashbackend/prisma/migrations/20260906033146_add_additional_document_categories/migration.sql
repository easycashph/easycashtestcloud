-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttachmentDocumentCategory" ADD VALUE 'DTI_SEC_REGISTRATION';
ALTER TYPE "AttachmentDocumentCategory" ADD VALUE 'BUSINESS_PERMIT';
ALTER TYPE "AttachmentDocumentCategory" ADD VALUE 'INCOME_TAX_RETURN';
ALTER TYPE "AttachmentDocumentCategory" ADD VALUE 'BANK_STATEMENT';
ALTER TYPE "AttachmentDocumentCategory" ADD VALUE 'CERTIFICATE_OF_EMPLOYMENT';
ALTER TYPE "AttachmentDocumentCategory" ADD VALUE 'POEA_CONTRACT';
ALTER TYPE "AttachmentDocumentCategory" ADD VALUE 'ALLOTMENT_SLIP';
ALTER TYPE "AttachmentDocumentCategory" ADD VALUE 'FLIGHT_DETAILS';
ALTER TYPE "AttachmentDocumentCategory" ADD VALUE 'PASSPORT_ID';
