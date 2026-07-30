-- CreateTable
CREATE TABLE "psgc_regions" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "psgc_regions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "psgc_provinces" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,

    CONSTRAINT "psgc_provinces_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "psgc_city_municipalities" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provinceCode" TEXT NOT NULL,

    CONSTRAINT "psgc_city_municipalities_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "psgc_barangays" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityMunicipalityCode" TEXT NOT NULL,

    CONSTRAINT "psgc_barangays_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "psgc_provinces_regionCode_idx" ON "psgc_provinces"("regionCode");

-- CreateIndex
CREATE INDEX "psgc_city_municipalities_provinceCode_idx" ON "psgc_city_municipalities"("provinceCode");

-- CreateIndex
CREATE INDEX "psgc_barangays_cityMunicipalityCode_idx" ON "psgc_barangays"("cityMunicipalityCode");

-- AddForeignKey
ALTER TABLE "psgc_provinces" ADD CONSTRAINT "psgc_provinces_regionCode_fkey" FOREIGN KEY ("regionCode") REFERENCES "psgc_regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psgc_city_municipalities" ADD CONSTRAINT "psgc_city_municipalities_provinceCode_fkey" FOREIGN KEY ("provinceCode") REFERENCES "psgc_provinces"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psgc_barangays" ADD CONSTRAINT "psgc_barangays_cityMunicipalityCode_fkey" FOREIGN KEY ("cityMunicipalityCode") REFERENCES "psgc_city_municipalities"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
