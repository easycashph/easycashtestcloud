-- DropIndex
DROP INDEX "document_templates_legacyId_key";

-- AlterTable
ALTER TABLE "document_template_mappings" DROP COLUMN "sortIndex";

-- AlterTable
ALTER TABLE "document_templates" DROP COLUMN "contentHtml",
DROP COLUMN "isActive",
DROP COLUMN "legacyId",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "isRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "generated_loan_documents" (
    "id" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "documentTemplateId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_loan_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_loan_documents_loanAccountId_idx" ON "generated_loan_documents"("loanAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_code_key" ON "document_templates"("code");

-- AddForeignKey
ALTER TABLE "generated_loan_documents" ADD CONSTRAINT "generated_loan_documents_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_loan_documents" ADD CONSTRAINT "generated_loan_documents_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_loan_documents" ADD CONSTRAINT "generated_loan_documents_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

