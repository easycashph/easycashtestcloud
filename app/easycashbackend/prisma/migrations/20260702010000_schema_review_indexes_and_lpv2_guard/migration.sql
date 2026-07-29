-- EasyCash Digital Lending Platform — Schema Review Follow-Up Migration
-- Source: Schema Review Report (pre-Milestone-6 audit) — approved changes only.
-- Scope: production indexes (SR-06..SR-13) + LPV-2 database defense-in-depth.
-- No architecture change, no new tables, no column renames, no data change.
--
-- Hand-authored (same basis as the initial migration): no live PostgreSQL
-- instance is available in this dev environment, so this could not be
-- generated via a `prisma migrate dev` shadow-database diff. Column names
-- were verified directly against `20260702000000_init/migration.sql`
-- rather than assumed. Action item before first real deployment: run
-- `npx prisma migrate dev` once against a live Postgres to have Prisma
-- confirm this migration through its normal workflow — should be a
-- no-op confirmation, not a functional change.

-- ----------------------------------------------------------------------------
-- Schema Review SR-06/SR-07/SR-08: Borrower branch/officer/status filtering
-- and name/phone search (PROJECT_RULES.md §Search) were unindexed.
-- ----------------------------------------------------------------------------

-- CreateIndex
CREATE INDEX "borrowers_branchId_idx" ON "borrowers"("branchId");

-- CreateIndex
CREATE INDEX "borrowers_assignedLoanOfficerId_idx" ON "borrowers"("assignedLoanOfficerId");

-- CreateIndex
CREATE INDEX "borrowers_status_idx" ON "borrowers"("status");

-- CreateIndex
CREATE INDEX "borrowers_lastName_idx" ON "borrowers"("lastName");

-- CreateIndex
CREATE INDEX "borrowers_firstName_idx" ON "borrowers"("firstName");

-- CreateIndex
CREATE INDEX "borrowers_mobilePhone1_idx" ON "borrowers"("mobilePhone1");

-- ----------------------------------------------------------------------------
-- Schema Review SR-09: search by Government ID (PROJECT_RULES.md §Search).
-- ----------------------------------------------------------------------------

-- CreateIndex
CREATE INDEX "identification_documents_documentNumber_idx" ON "identification_documents"("documentNumber");

-- ----------------------------------------------------------------------------
-- Schema Review SR-10: branch dashboards and Loan Officer Performance
-- reports (PROJECT_RULES.md §Reports).
-- ----------------------------------------------------------------------------

-- CreateIndex
CREATE INDEX "loan_accounts_branchId_idx" ON "loan_accounts"("branchId");

-- CreateIndex
CREATE INDEX "loan_accounts_loanOfficerId_idx" ON "loan_accounts"("loanOfficerId");

-- ----------------------------------------------------------------------------
-- Schema Review SR-11 (Critical): loan_transactions is the highest-volume
-- table (legacy equivalent: 524k rows) — date-range and officer/branch-
-- filtered transaction reports were unindexed.
-- ----------------------------------------------------------------------------

-- CreateIndex
CREATE INDEX "loan_transactions_entryDate_idx" ON "loan_transactions"("entryDate");

-- CreateIndex
CREATE INDEX "loan_transactions_postedByUserId_idx" ON "loan_transactions"("postedByUserId");

-- CreateIndex
CREATE INDEX "loan_transactions_branchId_idx" ON "loan_transactions"("branchId");

-- ----------------------------------------------------------------------------
-- Schema Review SR-12 (Critical): Aging, Delinquency, Expected Collection,
-- and Daily Collection reports (PROJECT_RULES.md §Reports) filter on due
-- date and status.
-- ----------------------------------------------------------------------------

-- CreateIndex
CREATE INDEX "repayment_schedules_dueDate_idx" ON "repayment_schedules"("dueDate");

-- CreateIndex
CREATE INDEX "repayment_schedules_status_idx" ON "repayment_schedules"("status");

-- ----------------------------------------------------------------------------
-- Schema Review SR-13: time-range audit browsing and per-user audit queries.
-- ----------------------------------------------------------------------------

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- ----------------------------------------------------------------------------
-- Schema Review SR-30: LPV-2 database defense-in-depth.
--
-- LPV-2 ("only one Active version per product") is a Phase 1.5 Hard Rule.
-- It was previously enforced only in the application layer. Prisma's schema
-- DSL (`@@unique`, `@@index`) cannot express a *conditional/partial* unique
-- constraint — Prisma unique constraints always apply to every row in the
-- table, with no `WHERE` clause support. PostgreSQL's partial unique index
-- feature (`CREATE UNIQUE INDEX ... WHERE <condition>`) has no equivalent
-- in the Prisma schema language as of the version used in this project, so
-- this constraint must be authored directly in raw SQL, in a migration file,
-- rather than in schema.prisma. The Prisma schema itself documents this via
-- a comment pointing here (see `LoanProductVersion.isActive` in
-- prisma/schema.prisma).
--
-- This index enforces: for a given loanProductId, at most one row may have
-- isActive = true. Rows with isActive = false are unconstrained by this
-- index (partial indexes only cover rows matching the WHERE clause).
-- ----------------------------------------------------------------------------

-- CreateIndex
CREATE UNIQUE INDEX "loan_product_versions_one_active_per_product"
  ON "loan_product_versions"("loanProductId")
  WHERE "isActive" = true;
