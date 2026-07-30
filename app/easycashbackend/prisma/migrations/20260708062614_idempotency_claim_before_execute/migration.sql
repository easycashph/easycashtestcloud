-- AlterTable
ALTER TABLE "idempotency_keys" ALTER COLUMN "statusCode" DROP NOT NULL,
ALTER COLUMN "responseBody" DROP NOT NULL;
