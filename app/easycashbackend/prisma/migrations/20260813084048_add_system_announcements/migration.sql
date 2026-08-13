-- CreateEnum
CREATE TYPE "SystemAnnouncementType" AS ENUM ('MAINTENANCE', 'NEWS', 'GENERAL');

-- CreateTable
CREATE TABLE "system_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "SystemAnnouncementType" NOT NULL DEFAULT 'GENERAL',
    "showOnLms" BOOLEAN NOT NULL DEFAULT true,
    "showOnPortal" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_announcements_active_expiresAt_idx" ON "system_announcements"("active", "expiresAt");

-- AddForeignKey
ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
