-- CreateTable
CREATE TABLE "loan_signing_sessions" (
    "id" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "otpCodeHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpVerifiedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdByIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_signing_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_signing_documents" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "generatedLoanDocumentId" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signedStorageKey" TEXT,
    "signedByIp" TEXT,
    "signedUserAgent" TEXT,

    CONSTRAINT "loan_signing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_signing_sessions_tokenHash_key" ON "loan_signing_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "loan_signing_sessions_loanAccountId_idx" ON "loan_signing_sessions"("loanAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_signing_documents_sessionId_generatedLoanDocumentId_key" ON "loan_signing_documents"("sessionId", "generatedLoanDocumentId");

-- AddForeignKey
ALTER TABLE "loan_signing_sessions" ADD CONSTRAINT "loan_signing_sessions_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_signing_sessions" ADD CONSTRAINT "loan_signing_sessions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_signing_documents" ADD CONSTRAINT "loan_signing_documents_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "loan_signing_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_signing_documents" ADD CONSTRAINT "loan_signing_documents_generatedLoanDocumentId_fkey" FOREIGN KEY ("generatedLoanDocumentId") REFERENCES "generated_loan_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
