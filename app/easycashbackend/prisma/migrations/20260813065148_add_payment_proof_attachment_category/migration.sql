-- AlterEnum
ALTER TYPE "AttachmentDocumentCategory" ADD VALUE 'PAYMENT_PROOF';

-- DropForeignKey
ALTER TABLE "profile_notes" DROP CONSTRAINT "profile_notes_authorUserId_fkey";

-- AddForeignKey
ALTER TABLE "profile_notes" ADD CONSTRAINT "profile_notes_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
