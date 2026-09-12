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

## Verification

Manually cross-checked the `DATABASE_DUMP` progress logic against the live database rather than
leaving it untested: ran `pg_dump --verbose` by hand inside the `easycashbackend` container and
confirmed its `"dumping contents of table ..."` line count (76) exactly matches the
`information_schema.tables` count used to set `recordCount` up front. The regex and the approach
are sound for this Postgres/pg_dump version.

## Follow-up: pulling in concurrent work from another machine

Right after this feature shipped, `git pull` brought in a large, unrelated feature from another
machine (Loan Application Risk Assessment / DTI risk tier, `INCOMPLETE` application status,
document-completeness recheck — 34 files, 2 new Prisma migrations). Standard sync steps followed:
`prisma migrate deploy` (both migrations applied cleanly), `write-build-info`, then
`docker compose up -d --build easycashbackend lmsfrontend portalfrontend`.

**Gotcha found**: that rebuild command reported `Image easycash-portalfrontend Built` but did
**not** recreate the running `portalfrontend` container — it stayed on its old image (36h uptime,
unchanged) even though `lmsfrontend` and `easycashbackend` were correctly recreated in the same
command. Cause not root-caused (compose's change-detection didn't trigger a recreate for that one
service this time); worked around with a follow-up `docker compose up -d --force-recreate
portalfrontend`. **Worth double-checking container uptime (`docker ps`) after any multi-service
`--build` rebuild** rather than trusting the compose output alone — this is a similar class of
"looks deployed but isn't" issue as `[[project_stale_docker_wsl_port_forward]]`.

## Current state

- All rebuilds completed; `easycashbackend`/`lmsfrontend`/`portalfrontend` containers verified
  healthy and actually running the latest images (checked via `docker ps` uptime, not just the
  compose command's own output).
- The cancelled "Download All Loan Accounts" export needs to be re-requested by the user if still
  wanted — it will now show live progress.
- Repo and DB are in sync with `origin/main` at commit `059247ee` as of this log.
