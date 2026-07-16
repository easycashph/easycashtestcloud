-- AlterTable
ALTER TABLE "loan_accounts" ADD COLUMN "sourceApplicationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "loan_accounts_sourceApplicationId_key" ON "loan_accounts"("sourceApplicationId");

-- AddForeignKey
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_sourceApplicationId_fkey"
  FOREIGN KEY ("sourceApplicationId") REFERENCES "loan_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
