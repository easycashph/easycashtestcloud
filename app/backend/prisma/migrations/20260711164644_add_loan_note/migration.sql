-- CreateTable
CREATE TABLE "loan_notes" (
    "id" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_notes_loanAccountId_idx" ON "loan_notes"("loanAccountId");

-- AddForeignKey
ALTER TABLE "loan_notes" ADD CONSTRAINT "loan_notes_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_notes" ADD CONSTRAINT "loan_notes_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
