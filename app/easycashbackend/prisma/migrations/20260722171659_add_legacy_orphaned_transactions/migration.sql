-- CreateTable
CREATE TABLE "legacy_orphaned_transactions" (
    "id" TEXT NOT NULL,
    "legacyTransactionId" TEXT NOT NULL,
    "parentAccountKey" TEXT NOT NULL,
    "legacyType" TEXT,
    "amount" DECIMAL(14,2),
    "entryDate" TIMESTAMP(3),
    "comment" TEXT,
    "rawDocument" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_orphaned_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legacy_orphaned_transactions_legacyTransactionId_key" ON "legacy_orphaned_transactions"("legacyTransactionId");

-- CreateIndex
CREATE INDEX "legacy_orphaned_transactions_parentAccountKey_idx" ON "legacy_orphaned_transactions"("parentAccountKey");
