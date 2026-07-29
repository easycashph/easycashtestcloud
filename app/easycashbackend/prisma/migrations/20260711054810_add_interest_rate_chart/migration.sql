-- CreateTable
CREATE TABLE "interest_rate_chart" (
    "id" TEXT NOT NULL,
    "addOnRatePercent" DECIMAL(6,3) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "contractualRatePercent" DECIMAL(6,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interest_rate_chart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interest_rate_chart_addOnRatePercent_termMonths_key" ON "interest_rate_chart"("addOnRatePercent", "termMonths");
