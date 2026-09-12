# Session Log — 2026-09-12 — Bulk Export Progress Tracking

**Machine:** Office Server PC
**Requested by:** Nomer Perez

## Summary

User had a "Download All Loan Accounts" bulk export running for ~8 hours (1,812 records, 2009-05-01
to 2026-09-30) and asked to check its status ("check progress"). Found it via the `bulk_export_jobs`
table — still PROCESSING, not stuck (confirmed by watching its result ZIP grow across two `docker
compose exec` checks 8 seconds apart, ~7.3GB and rising). The job itself has no per-record progress
logging, so there was no way to tell *how much longer* it would take — just that it was alive.

User then asked to add a real percent-complete indicator to the LMS ("ilang percent na ng download,
para malaman gaano pa katagal"), for all three export types (Download All Clients, Download All Loan
Accounts, Export Database).

## What was built

- **`BulkExportJob` domain model** gains `processedRecords` (nullable int), reset to 0 in
  `markProcessing`, updated via a new `updateProgress()` method, and set to `recordCount` in
  `markCompleted`. New Prisma column via migration `20260912055727_add_bulk_export_progress`
  (applied with `prisma migrate deploy` after `prisma migrate dev` hung — see Errors below).
- **Attachment exports** (`BORROWER_ATTACHMENTS` / `LOAN_ACCOUNT_ATTACHMENTS`, same shared
  `runAttachmentExport` method): `processedRecords` is updated after each record (borrower or loan
  account), persisted only when the whole-percent value actually changes — avoids one DB write per
  record on a job with thousands of records.
- **Database dump** (`DATABASE_DUMP`): `pg_dump` has no native progress output, but its `--verbose`
  flag logs one `"dumping contents of table ..."` line per table to stderr as it runs. Query
  `information_schema.tables` for the schema's total table count up front, then count those stderr
  lines against it — same `processedRecords`/`recordCount` shape as the attachment exports, so the
  UI needs no special-casing per export type.
- **Frontend (`BulkExportsPage.tsx`)**: a small progress bar + percent under the status pill while a
  job is `PROCESSING`, plus a simple ETA (`~X min left`) linearly projected from elapsed time and
  percent complete — intentionally not shown at 0% (a linear projection from zero progress is worse
  than no estimate at all).

## Errors and fixes

- **`prisma migrate dev --create-only` hung indefinitely** (likely waiting on shadow-database
  creation/permission it never got, or a drift-detection prompt with no TTY to answer it) — killed
  via `TaskStop`, then **verified the underlying `node.exe` processes were still running after
  TaskStop reported success** (per this session's own standing lesson, see `[[feedback_verify_
  taskstop_actually_killed_db_scripts]]`) and had to `taskkill /F` them directly. Recovered by
  hand-writing the migration SQL file and applying it with `prisma migrate deploy` instead, which
  doesn't need a shadow database and isn't interactive.

## Deployment sequencing (why this took two rebuilds)

The user's 8-hour export was still `PROCESSING` when the code was ready to ship. Restarting
`easycashbackend` to deploy would have killed it outright — per this job type's own documented
behavior, a mid-flight job left `PROCESSING` when the server restarts never resumes; it just sits
there forever until re-requested. Flagged this to the user before rebuilding rather than assuming
it was fine to interrupt; user cancelled the job themselves (confirmed via DB: status flipped to
`CANCELLED`, `errorMessage: 'Cancelled by staff'`) and said to proceed.

First rebuild deployed the feature. A `git push` right after was rejected (remote had two docs-only
commits from Macbook Nomer syncing session logs) — pulled and merged (no code conflicts, only
`build-info.json` needed a redo since it's regenerated, not merged), then rebuilt a second time
solely so the running containers' `build-info.json` matches the actual latest commit — consistent
with why this project tracks build info at all (catching a stale deployment across its multiple
independently-deployed machines).

## Current state

- Both rebuilds completed; `easycashbackend`/`lmsfrontend` containers healthy on the latest commit.
- The cancelled "Download All Loan Accounts" export needs to be re-requested by the user if still
  wanted — it will now show live progress.
- Not yet done: no automated test for the `pg_dump --verbose` progress-parsing regex — it depends on
  exact wording in pg_dump's stderr output, which could differ across postgresql-client versions.
  Worth a smoke test (a small `DATABASE_DUMP` export) after this log is written, to confirm the
  percent actually advances instead of sitting at 0% for the whole dump.
