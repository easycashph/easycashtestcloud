-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "borrowerId" TEXT;

-- CreateIndex
CREATE INDEX "loan_applications_borrowerId_idx" ON "loan_applications"("borrowerId");

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
