-- Add LicensedRecruitmentAgency reference table (2026-09-14, Agency name dropdown feature)
CREATE TABLE "licensed_recruitment_agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "licenseNumber" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licensed_recruitment_agencies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "licensed_recruitment_agencies_name_idx" ON "licensed_recruitment_agencies"("name");
CREATE INDEX "licensed_recruitment_agencies_status_idx" ON "licensed_recruitment_agencies"("status");
