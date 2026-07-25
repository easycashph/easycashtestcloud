-- AlterTable
ALTER TABLE "co_borrowers" ADD COLUMN     "middleName" TEXT;

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "coBorrowerFirstName" TEXT,
ADD COLUMN     "coBorrowerLastName" TEXT,
ADD COLUMN     "coBorrowerMiddleName" TEXT;
