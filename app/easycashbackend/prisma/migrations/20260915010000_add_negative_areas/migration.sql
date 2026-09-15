-- Add NegativeArea reference table (2026-09-15, Negative Areas pre-qualification check)
CREATE TABLE "negative_areas" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "areaName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negative_areas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "negative_areas_city_areaName_key" ON "negative_areas"("city", "areaName");
CREATE INDEX "negative_areas_city_idx" ON "negative_areas"("city");
