-- AlterTable
ALTER TABLE "borrower_income_details" ADD COLUMN     "monthlyIncome" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "barangay" TEXT,
ADD COLUMN     "cityMunicipality" TEXT,
ADD COLUMN     "houseUnitNumber" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "zipCode" TEXT;
