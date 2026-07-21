/*
  Warnings:

  - You are about to drop the column `asOfDate` on the `generated_statements_of_account` table. All the data in the column will be lost.
  - Added the required column `accruedInterestAsOfDate` to the `generated_statements_of_account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `penaltyAsOfDate` to the `generated_statements_of_account` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "generated_statements_of_account" DROP COLUMN "asOfDate",
ADD COLUMN     "accruedInterestAsOfDate" DATE NOT NULL,
ADD COLUMN     "penaltyAsOfDate" DATE NOT NULL;
