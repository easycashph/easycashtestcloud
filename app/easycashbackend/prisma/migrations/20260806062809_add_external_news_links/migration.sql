-- CreateEnum
CREATE TYPE "ExternalNewsCategory" AS ENUM ('FINANCE', 'ADVISORY');

-- CreateTable
CREATE TABLE "external_news_links" (
    "id" TEXT NOT NULL,
    "category" "ExternalNewsCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_news_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_news_links_sourceUrl_key" ON "external_news_links"("sourceUrl");

-- CreateIndex
CREATE INDEX "external_news_links_category_publishedAt_idx" ON "external_news_links"("category", "publishedAt");
