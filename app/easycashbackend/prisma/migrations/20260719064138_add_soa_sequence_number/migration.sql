/*
  Warnings:

  - Added the required column `soaSequenceNumber` to the `generated_statements_of_account` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "generated_statements_of_account" ADD COLUMN     "soaSequenceNumber" INTEGER NOT NULL;
