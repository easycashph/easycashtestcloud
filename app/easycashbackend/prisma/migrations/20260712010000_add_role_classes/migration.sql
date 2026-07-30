-- DropIndex
DROP INDEX "profile_activity_logs_created_at_idx";

-- CreateTable
CREATE TABLE "role_classes" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_classes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_classes_roleId_name_key" ON "role_classes"("roleId", "name");

-- CreateIndex
CREATE INDEX "profile_activity_logs_createdAt_idx" ON "profile_activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "role_classes" ADD CONSTRAINT "role_classes_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "profile_activity_logs_profile_idx" RENAME TO "profile_activity_logs_profileType_profileId_idx";

-- RenameIndex
ALTER INDEX "profile_activity_logs_user_id_idx" RENAME TO "profile_activity_logs_userId_idx";
