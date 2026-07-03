-- EasyCash Digital Lending Platform — Milestone 9.1 Checkpoint 1
-- Source: docs/Architecture/ADR-optimistic-concurrency.md, decided in
-- FINANCIAL_INVARIANTS.md §6 and formalized as a standalone ADR in
-- Milestone 9. Scope: add a `version` column to every balance-mutating
-- aggregate (LoanAccount, RepaymentSchedule) so future writes can use a
-- conditional `UPDATE ... WHERE id = ? AND version = ?` instead of an
-- unconditional upsert. No data change, no column renames, no new tables.
--
-- Hand-authored, same basis as both prior migrations in this project: no
-- live PostgreSQL instance is available in this dev environment, so this
-- could not be generated via a `prisma migrate dev` shadow-database diff.
-- Column/table names were verified directly against
-- `20260702000000_init/migration.sql` and the current `schema.prisma`
-- rather than assumed. Action item before first real deployment: run
-- `npx prisma migrate dev` once against a live Postgres to have Prisma
-- confirm this migration through its normal workflow — should be a no-op
-- confirmation, not a functional change.
--
-- `DEFAULT 0` backfills every existing row with `version = 0` in the same
-- statement — no separate UPDATE pass is needed.

-- ----------------------------------------------------------------------------
-- ADR-optimistic-concurrency §3: LoanAccount is a balance-mutating
-- aggregate (principal/interest/fees/penalty balance/paid/due) requiring
-- optimistic concurrency for every future write that touches those fields.
-- ----------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "loan_accounts" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- ----------------------------------------------------------------------------
-- ADR-optimistic-concurrency §3: RepaymentSchedule (the table backing the
-- `RepaymentInstallment` domain aggregate) is the second, and — per the
-- ADR — currently last, balance-mutating aggregate in scope.
-- ----------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "repayment_schedules" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
