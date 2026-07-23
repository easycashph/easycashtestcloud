-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "portalAccountId" TEXT;

-- CreateIndex
CREATE INDEX "loan_applications_portalAccountId_idx" ON "loan_applications"("portalAccountId");

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "portal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
