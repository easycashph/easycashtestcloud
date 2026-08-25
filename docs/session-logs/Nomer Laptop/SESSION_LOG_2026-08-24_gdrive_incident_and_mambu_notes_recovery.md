# Session Log: 2026-08-24 (Nomer Laptop) — Google Drive credential-exposure incident, and Mambu notes recovery

Continues `docs/session-logs/Nomer Laptop/SESSION_LOG_2026-08-23_launcher_audit_and_session_log_folder.md`.

## 1. Google Drive auto-backup incident — found, contained, root-caused

User noticed unfamiliar folders (`node_modules`, `lucide-react`, `compat`, `shared`, `data`, `dist`,
`core`, `v3`, `tests`) surfacing in their Google Drive. Investigated with the Google Drive MCP
connector (loaded via `ToolSearch` mid-session) plus local filesystem checks — the connector's own
`root`/search semantics didn't match what the browser's "My Drive" showed (queries against
`parentId = 'root'` returned a different, org-shared-drive space), so verification leaned on the
user's own screenshots cross-checked against what could be confirmed independently.

Findings, in the order discovered:
- A **Windows Scheduled Task** ("ECLC Claude Code - Google Drive Backup") was still enabled,
  pointing at `C:\ECLC CLAUDE CODE\backup-to-google-drive.ps1` — a script already deleted from the
  repo in an earlier "stale-script cleanup" commit (`4c90df3`). Its pre-cleanup version (before
  `76eb20c`'s rclone `--config` fix) is the suspected root cause: it appears to have synced the
  wrong source path at some point, uploading raw `node_modules` contents and this laptop's own
  `src/{domain,application,interface,infrastructure}` folders as flattened top-level Drive items,
  rather than the intended `local\backups\` output only.
- Also found a full, credential-bearing mirror at Drive's `My Drive > ECLC CLAUDE CODE Backup` —
  contains `app/` (so `easycashbackend/.env`), `local/`, `legacy/` (so the real production
  SMTP/M360 credentials noted in an earlier session), and `backup-mongodb.bat` (has a live MongoDB
  password inline). This predates and is separate from the flattened-junk folders above.

Actions taken, in order:
1. **Disabled** (not deleted — reversible) the scheduled task via `Disable-ScheduledTask`.
   Confirmed `State: Disabled` afterward.
2. Walked the user through manually verifying the Drive-side selection boundary before any
   deletion — had them report the exact last-selected/first-unselected item names (`domain` /
   `Google AI Studio`) rather than trusting a low-resolution screenshot read, since a wrong bulk
   delete here would be irreversible-in-practice (Drive Trash empties eventually).
3. User asked whether the junk could be moved to "Computers" instead of deleted — explained that's
   not how Drive Desktop's Computer-backup area works (it's managed by the desktop app's own local
   folder selection, not a manual drag target), and that this specific content has zero backup
   value anyway (node_modules is disposable/reproducible; the source-code folders duplicate what
   git/GitHub already holds). User agreed to delete both the junk and the `ECLC CLAUDE CODE Backup`
   mirror.
4. **Not yet done by end of session**: actually emptying Drive Trash, and the credential-rotation
   pass (DB password, 3 JWT secrets, SMTP password, SDevTech SFTP password, M360 SMS gateway,
   Cloudflare API token, MongoDB remote password) — user said they want to do the replacement
   backup setup on the **Office Server PC** first, then circle back. Nothing was rotated this
   session.
5. Recommended (not yet built) a correctly-scoped replacement: sync only `local\backups\` via
   rclone — the DB-dump/attachment output the already-existing `scripts\Backup Remote Postgres
   Snapshot.bat` produces — never the whole repo. Secrets themselves should move to a password
   manager rather than any file-based backup, syncing or not.

## 2. Investigated: why do 92% of borrowers have no address on file?

User asked to check accounts with no address. Queried live Postgres directly (`docker exec
easycash-postgres-1 psql`, correct role turned out to be `easycash`, not `postgres` — the .env's
own `DATABASE_URL` had the right credentials all along): **4,273 of 4,610 borrowers (92.7%)** have
zero `Address` rows.

Traced this all the way to the source rather than assuming a migration bug:
- Confirmed `Borrower` has no inline address fields — Address is only ever the separate polymorphic
  table, so the gap is real, not a display issue.
- Read `migrate-legacy-data.ts`'s `migrateBorrowers` — addresses come from a `groupBy(loadAll('addresses'),
  'parent_key')` lookup keyed on the client's own Mongo `_id`.
- Sampled the raw SDevTech Mongo dump directly (small ad-hoc script against `iterDocs`/`BSON`, run
  and deleted, not committed): the `addresses` collection itself only has **1,288** rows against
  **4,632** clients. Of those, 702 correctly resolve to a borrower, 498 to a co-borrower (a
  different, correctly-separate migration path), and only 88 are genuinely orphaned. **689 imported
  into Postgres vs. 702 resolvable — the migration is working correctly; SDevTech's own source data
  is what's sparse.**

**Conclusion delivered to the user: not a bug, a chronic data-collection gap.** No code change
made — correctly distinguished "confirmed via source data" from "assumed," per this project's own
stated principle for legacy-data findings.

## 3. Traced the address gap one system further back — into Mambu itself

User supplied a from-scratch Mambu (pre-SDevTech, the original system Easycash used) export:
`legacy/Easycash-20231115T012529Z-001.zip`, a single 1.1 GB `easycash.sql` mysqldump. Explored it
properly rather than guessing from the filename:

- Confirmed it's a genuine Mambu core-banking schema (`client`, `address`, `loanaccount`, `comment`,
  `gljournalentry`, etc.) via `CREATE TABLE` scan.
- **Found the missing link**: SDevTech's own `client_accounts.uid` field (e.g.
  `8a8e8e946f823fdd016f828f340a0d95`) is literally the original Mambu `client.ENCODEDKEY` — and this
  system's own `Borrower.legacyId` is already populated from that same `uid` (confirmed by sampling
  live Postgres). So Mambu data joins directly onto current borrowers with no extra mapping needed.
- Wrote a one-off buffer-based mysqldump parser (line-based `readline` truncated silently on
  embedded newlines inside address/comment text — switched to byte-offset `Buffer.indexOf` scanning
  instead, and needed `--max-old-space-size` to avoid an OOM crash parsing the 20K-row `comment`
  table under default Node heap). Not committed — folded the validated logic into the real script
  in §4 instead of leaving throwaway scripts in the repo.
- **Address recovery from Mambu: negligible.** Only 14 address rows exist in the *entire* Mambu
  database against 4,413 total clients (0.3%) — the gap predates SDevTech entirely, going back to
  the very first system. 11 of the 14 do match a current borrower; not worth a dedicated import for
  that alone.
- **Loan-account notes recovery from Mambu: substantial.** 20,707 `comment` rows exist, 18,796 tied
  to a `loanaccount` via `PARENTKEY`. Mambu's own loan-account `ID` field (e.g. `BL-REG_U3V0J`) uses
  the exact same `{productCode}_{code}` format this system's `LoanAccount.loanCode` already does —
  1,190 of 5,699 Mambu loan accounts match a `loanCode` still in this database today, carrying
  9,232 importable historical collector/loan-officer notes.

## 4. Built and dry-run-verified `migrate-mambu-notes.ts` (`aa76641`)

Mirrors `migrate-legacy-data.ts`'s existing `migrateProfileNotes` phase exactly (same `stripHtml`,
same `Reconciliation`/dry-run/`--apply` convention, same `ProfileNote` target table) rather than
inventing a new pattern — this is the same class of work, just a second, earlier source system.

- Reads `legacy/mambu/easycash.sql` (the zip extracted once to a permanent, gitignored location —
  added `legacy/Easycash-*.zip` and `legacy/mambu/` to `.gitignore` *before* touching the file,
  same PII-safety discipline as every other legacy source in this repo).
- Idempotent via `legacyId = "mambu:" + comment.ENCODEDKEY` — the `mambu:` prefix is belt-and-braces
  (Mambu's 32-char hex keys and SDevTech's 24-char Mongo ObjectIds can't collide by format alone,
  but the prefix also makes the note's origin traceable at a glance later).
- Only imports a comment when its resolved Mambu loan code matches a **currently-existing**
  `LoanAccount.loanCode` — a loan that never carried forward past Mambu has nowhere real to attach
  its notes to, so it's skipped and counted, not guessed at.
- Dry run confirmed: **9,232 of 20,707 comments migrated** (skips: 9,479 loan-not-carried-forward,
  1,904 non-loan parent, 92 empty-after-stripping-HTML). Matches the ad-hoc investigation numbers
  from §3 almost exactly.
- **Not yet applied** — user asked to commit/push the script itself first; `--apply` (the actual DB
  write) is a separate pending step, explicitly confirmed as purely additive/idempotent before
  asking for the go-ahead.

## 5. Housekeeping: a stray uncommitted `package-lock.json` diff, and an old unrelated stash

- A 1-line local `package-lock.json` change (unrelated noise, not this session's work) blocked a
  `git pull` mid-task — stashed rather than discarded (`git status`-first discipline), then dropped
  once the same pull brought in a legitimate 587-line lockfile update that superseded it.
- Found a second, much older stash (`stash@{1}`, "CP12 follow-up work...") referencing `app/backend`/
  `app/frontend` — pre-dates the current `app/easycashbackend`/`app/lmsfrontend` module layout
  entirely. Left untouched; noted to the user rather than silently dropped, per this project's
  standing rule against destructive actions on unfamiliar state.

## 6. Moved Exports onto the permission system, and fixed a real hidden-permission bug (`c3e8ed9`)

User asked to add the LMS Exports feature (client/loan attachments, DB dump — landed earlier today
from the office server, `bulk-export` module) to the Roles & Permissions system, toggled ON for MIS
only. It had shipped hard-restricted via `requireRole('MIS')`, with an explicit doc comment arguing
that was deliberate ("not something MIS should be able to reconfigure"). Implemented the requested
change anyway — the user is the one who gets to decide that, not a prior comment — and recorded the
change plainly in the new code rather than silently overwriting the old reasoning.

- New permission code `bulk_export.use` (`seed.ts`), not added to any role's default grant except
  MIS (which gets `permissionCodes` — every code — automatically as the super-user role), so
  behavior is unchanged today; configurable from Roles & Permissions going forward.
- Backend `bulkExportRouter.ts`: `requireRole('MIS')` → `requirePermission('bulk_export.use')` on
  all four routes.
- Frontend `BulkExportsPage.tsx`: hardcoded `currentAccount.roles.includes('MIS')` →
  `canUseBulkExport` (new boolean on `roleContext.tsx`, same pattern as every other `can*` flag).
- **Found while wiring this up, not asked for but fixed in the same pass**: `RolesPermissionsTab`'s
  module-grouping logic silently dropped any permission whose code prefix had no `MODULE_META`
  entry — `moduleLabel()` falls back to `'Other'`, but `MODULE_ORDER` never listed `'Other'`, so
  `.filter(g => g.permissions.length > 0)` discarded the group entirely. `bulk_export.use` would
  have hit this immediately; `system_announcement.manage` and `chat_canned_response.manage` (both
  from earlier office-server work) were already silently invisible the same way — real, toggleable
  permissions with no way to see or toggle them in the UI. Added an `Exports` group, folded the
  other two into `Administration`, and added `'Other'` as a catch-all with a `Lock` fallback icon
  (the grouping code assumed every `MODULE_ORDER` label mapped back to a real `MODULE_META` entry —
  fixed that assumption too, not just the missing label, so a future ungrouped permission fails
  visibly instead of silently again).
- Needed `npm install` + `npx prisma generate` on this laptop before any of this would even
  typecheck — the `bulk-export` module's own dependencies (`archiver`) and Prisma model
  (`BulkExportJob`) had landed via `git pull` but never been installed/regenerated here. Also found
  `npx prisma db seed` doesn't work *inside* the Docker container (production image ships compiled
  `dist/` only, no `tsx`/dev deps) — ran the seed from the host against the exposed Postgres port
  instead, same as every other one-off script this session.
- Verified end to end: `bulk_export.use` confirmed granted to MIS only via direct SQL query, both
  containers healthy after two rebuild cycles (backend for the router, frontend for the page +
  the grouping fix).

## Verification

- `npx tsc --noEmit` clean after `npx prisma generate` (needed first — the Prisma Client was stale
  from migrations applied in a previous session before the client itself was regenerated; unrelated
  pre-existing errors in `PrismaChatRepository.ts`/`PrismaMisPostRepository.ts`/
  `PrismaPenaltyChargeRepository.ts` all resolved by the regenerate, confirming they weren't real
  bugs, just a stale client).
- `migrate-mambu-notes.ts` run in dry-run mode against the real `legacy/mambu/easycash.sql` and the
  live local database — no writes, full reconciliation printed and sanity-checked against the
  earlier ad-hoc investigation's numbers.
- Google Drive incident: every claim (scheduled task target, folder contents, selection boundary)
  was verified against either a live system query or a user-confirmed screenshot detail before
  acting — no destructive action taken on unverified information.
- §6: `npx tsc --noEmit` clean on both apps after the dependency/Prisma-client fixes; new
  permission's grant confirmed with a direct `psql` query (`bulk_export.use` → `MIS` only); both
  Docker rebuilds confirmed healthy (`/health` 200, frontend 200) before pushing.

## Open

- **Google Drive cleanup not finished**: Trash not yet emptied; credential rotation not started.
  User wants to set up the replacement backup (`scripts\Backup Remote Postgres Snapshot.bat` +
  properly-scoped rclone sync) on the Office Server PC first.
- **Mambu notes migration not yet applied** — script is committed and dry-run-verified only;
  `--apply` needs the user's explicit go-ahead (asked, not yet answered as of this log).
- Carried over, still untouched: the ₱19.3M post-maturity-penalty correction, accrued interest on
  long-defaulted accounts, and the Named Tunnel domain purchase decision.
