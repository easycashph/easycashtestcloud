-- AlterTable
ALTER TABLE "reminder_settings" ADD COLUMN     "portalEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "portalSmsEnabled" BOOLEAN NOT NULL DEFAULT false;
