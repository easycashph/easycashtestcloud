-- CreateEnum
CREATE TYPE "MisPostType" AS ENUM ('AUTO_ROTATION', 'MANUAL');

-- CreateTable
CREATE TABLE "mis_posts" (
    "id" TEXT NOT NULL,
    "type" "MisPostType" NOT NULL,
    "caption" TEXT NOT NULL,
    "imageStorageKey" TEXT NOT NULL,
    "imageFileName" TEXT NOT NULL,
    "imageFileType" TEXT NOT NULL,
    "poolOrder" INTEGER,
    "poolActive" BOOLEAN NOT NULL DEFAULT true,
    "isCurrentlyLive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mis_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mis_posts_type_isCurrentlyLive_idx" ON "mis_posts"("type", "isCurrentlyLive");

-- CreateIndex
CREATE INDEX "mis_posts_type_poolOrder_idx" ON "mis_posts"("type", "poolOrder");

-- CreateIndex
CREATE INDEX "mis_posts_type_withdrawn_expiresAt_idx" ON "mis_posts"("type", "withdrawn", "expiresAt");

-- AddForeignKey
ALTER TABLE "mis_posts" ADD CONSTRAINT "mis_posts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
