-- CreateEnum
CREATE TYPE "LoanApplicationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "LoanApplicationReviewState" AS ENUM ('UNREVIEWED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "LoanApplicationAccountType" AS ENUM ('NEW', 'RENEWAL');

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "age" INTEGER,
    "address" TEXT,
    "monthlyIncome" DECIMAL(14,2),
    "employer" TEXT,
    "propertiesOwned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creditScore" INTEGER,
    "coBorrowerName" TEXT,
    "referralSource" TEXT,
    "accountType" "LoanApplicationAccountType",
    "loanPurpose" TEXT,
    "requestedCategory" TEXT NOT NULL,
    "requestedAmount" DECIMAL(14,2) NOT NULL,
    "requestedTermMonths" INTEGER NOT NULL,
    "submittedDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "encodedByUserId" TEXT,
    "status" "LoanApplicationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewState" "LoanApplicationReviewState" NOT NULL DEFAULT 'UNREVIEWED',
    "assignedLoanProductVersionId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_applications_branchId_idx" ON "loan_applications"("branchId");

-- CreateIndex
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_encodedByUserId_fkey" FOREIGN KEY ("encodedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_assignedLoanProductVersionId_fkey" FOREIGN KEY ("assignedLoanProductVersionId") REFERENCES "loan_product_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
