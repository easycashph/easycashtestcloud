-- AlterTable
ALTER TABLE "borrowers" ADD COLUMN     "dependants" JSONB,
ADD COLUMN     "homeOwnership" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "placeOfBirth" TEXT;

-- AlterTable
ALTER TABLE "co_borrowers" ADD COLUMN     "employer" TEXT;

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "coBorrowerEmployer" TEXT,
ADD COLUMN     "dependants" JSONB,
ADD COLUMN     "homeOwnership" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "officeAddress" TEXT,
ADD COLUMN     "placeOfBirth" TEXT,
ADD COLUMN     "reference1Mobile" TEXT,
ADD COLUMN     "reference1Name" TEXT,
ADD COLUMN     "reference2Mobile" TEXT,
ADD COLUMN     "reference2Name" TEXT,
ADD COLUMN     "sssNumber" TEXT,
ADD COLUMN     "tinNumber" TEXT;
