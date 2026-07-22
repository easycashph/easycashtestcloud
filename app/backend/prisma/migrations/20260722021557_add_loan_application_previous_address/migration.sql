-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "previousAddress" TEXT,
ADD COLUMN     "previousAddressSameAsPresent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "previousBarangay" TEXT,
ADD COLUMN     "previousCityMunicipality" TEXT,
ADD COLUMN     "previousHouseUnitNumber" TEXT,
ADD COLUMN     "previousProvince" TEXT,
ADD COLUMN     "previousStreet" TEXT,
ADD COLUMN     "previousZipCode" TEXT;
