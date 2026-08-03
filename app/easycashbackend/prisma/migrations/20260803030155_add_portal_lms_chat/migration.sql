-- CreateEnum
CREATE TYPE "ChatConversationStatus" AS ENUM ('WAITING', 'CLAIMED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChatMessageSenderType" AS ENUM ('PORTAL_ACCOUNT', 'STAFF', 'SYSTEM');

-- AlterEnum
ALTER TYPE "AttachmentOwnerType" ADD VALUE 'CHAT_MESSAGE';

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "portalAccountId" TEXT NOT NULL,
    "status" "ChatConversationStatus" NOT NULL DEFAULT 'WAITING',
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "requiresManager" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" "ChatMessageSenderType" NOT NULL,
    "senderUserId" TEXT,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_conversations_status_requiresManager_createdAt_idx" ON "chat_conversations"("status", "requiresManager", "createdAt");

-- CreateIndex
CREATE INDEX "chat_conversations_claimedByUserId_idx" ON "chat_conversations"("claimedByUserId");

-- CreateIndex
CREATE INDEX "chat_conversations_portalAccountId_status_idx" ON "chat_conversations"("portalAccountId", "status");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_createdAt_idx" ON "chat_messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "portal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
