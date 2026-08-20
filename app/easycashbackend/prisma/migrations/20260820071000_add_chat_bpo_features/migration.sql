-- CreateEnum
CREATE TYPE "ChatAgentStatusType" AS ENUM ('ONLINE', 'AWAY', 'OFFLINE');

-- AlterTable
ALTER TABLE "chat_conversations" ADD COLUMN     "portalLastReadAt" TIMESTAMP(3),
ADD COLUMN     "portalTypingAt" TIMESTAMP(3),
ADD COLUMN     "ratedAt" TIMESTAMP(3),
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "ratingComment" TEXT,
ADD COLUMN     "staffLastReadAt" TIMESTAMP(3),
ADD COLUMN     "staffTypingAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "chat_agent_presence" (
    "userId" TEXT NOT NULL,
    "status" "ChatAgentStatusType" NOT NULL DEFAULT 'OFFLINE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_agent_presence_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "chat_canned_responses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_canned_responses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "chat_agent_presence" ADD CONSTRAINT "chat_agent_presence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_canned_responses" ADD CONSTRAINT "chat_canned_responses_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
