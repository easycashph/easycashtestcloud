-- EasyCash Digital Lending Platform — Milestone 9.1/9.2 Checkpoint 13
-- Source: docs/Architecture/MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md,
-- Decision Log #9. Scope: a new `idempotency_keys` table, checked before a
-- balance-mutating financial write (POST /loan-accounts/:id/activate,
-- POST /loan-accounts/:id/payments) to reject a duplicate client resubmission
-- before it reaches the use case layer. Deliberately separate from
-- `audit_logs` — that table records history; this one records replay state
-- and is looked up (not just written) on every request that carries an
-- Idempotency-Key header.
--
-- Hand-authored, same basis as every prior migration in this project: no
-- live PostgreSQL instance is available in this dev environment, so this
-- could not be generated via a `prisma migrate dev` shadow-database diff.
-- Column/table/constraint naming verified directly against
-- `20260702000000_init/migration.sql`'s existing conventions (e.g.
-- `audit_logs`, `refresh_tokens`) and the current `schema.prisma`. Action
-- item before first real deployment: run `npx prisma migrate dev` once
-- against a live Postgres to have Prisma confirm this migration through its
-- normal workflow — should be a no-op confirmation, not a functional change.

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_endpoint_key" ON "idempotency_keys"("key", "endpoint");

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
