-- CreateTable
CREATE TABLE "security_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enforceTwoFactorForAllUsers" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "security_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "security_settings" ADD CONSTRAINT "security_settings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
