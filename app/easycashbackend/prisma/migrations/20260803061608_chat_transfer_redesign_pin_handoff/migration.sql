/*
  Warnings:

  - You are about to drop the column `requiresManager` on the `chat_conversations` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "ChatConversationStatus" ADD VALUE 'PENDING_TRANSFER';

-- DropIndex
DROP INDEX "chat_conversations_status_requiresManager_createdAt_idx";

-- AlterTable
ALTER TABLE "chat_conversations" DROP COLUMN "requiresManager",
ADD COLUMN     "originalClaimedByUserId" TEXT,
ADD COLUMN     "pendingTransferFromUserId" TEXT,
ADD COLUMN     "pendingTransferPin" TEXT,
ADD COLUMN     "pendingTransferToUserId" TEXT;

-- CreateIndex
CREATE INDEX "chat_conversations_status_createdAt_idx" ON "chat_conversations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "chat_conversations_originalClaimedByUserId_idx" ON "chat_conversations"("originalClaimedByUserId");

-- CreateIndex
CREATE INDEX "chat_conversations_pendingTransferToUserId_idx" ON "chat_conversations"("pendingTransferToUserId");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_originalClaimedByUserId_fkey" FOREIGN KEY ("originalClaimedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_pendingTransferToUserId_fkey" FOREIGN KEY ("pendingTransferToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_pendingTransferFromUserId_fkey" FOREIGN KEY ("pendingTransferFromUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
