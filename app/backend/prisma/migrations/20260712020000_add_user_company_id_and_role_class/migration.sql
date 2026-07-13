-- AlterTable
ALTER TABLE "users" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "roleClassId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_companyId_key" ON "users"("companyId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleClassId_fkey" FOREIGN KEY ("roleClassId") REFERENCES "role_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
