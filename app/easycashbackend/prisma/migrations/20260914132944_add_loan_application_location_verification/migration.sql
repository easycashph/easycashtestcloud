-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "submissionLocationAccuracyMeters" DECIMAL(8,2),
ADD COLUMN     "submissionLocationCapturedAt" TIMESTAMP(3),
ADD COLUMN     "submissionLocationPermissionStatus" TEXT;
