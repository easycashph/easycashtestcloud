# Session Log — 2026-08-21 (MacBook Nomer): repo sync/migration recovery, LAN IP fixes, SOA on-screen penalty breakdown

## Context

Session running on Nomer's MacBook (his secondary dev machine and LMS backup laptop, distinct from
the Office Server PC which is the real/main server, and from his separate Laptop Nomer machine —
see the `project-office-server-vs-macbook` memory). This Mac's local Postgres/Docker stack had
drifted significantly behind `origin/main` (many days of other sessions' work across the Office
Server PC and elsewhere), so most of this session was catching this machine back up before the
actual feature work at the end.

## 1. Repo sync recovery (repeated across the session)

`git pull` was run many times over the course of the session, each time pulling in anywhere from a
handful to 100+ commits from other sessions (Add Fee feature, Add Penalty/kill-switch, on-screen
report tables, MIS Portal Posts, Portal chat BPO redesign, Roles & Permissions, Document Templates
admin config, and much more — see the individual commits in `origin/main`'s history for full
detail, not repeated here). Recurring pattern each time: `git fetch` → `git pull --ff-only` (or a
plain merge when this machine also had a local unpushed commit) → `npx prisma migrate deploy` for
any new migrations → `npx prisma generate` → `npm install` in whichever app(s) changed → `npx tsc
--noEmit` on backend and frontend → `docker compose up -d --build`. Every migration was checked for
`DROP TABLE`/`DROP COLUMN`/`TRUNCATE`/`DELETE FROM` before applying — all were purely additive or
narrow column drops on now-superseded fields (e.g. `undoneAt` after the Undo Restructure feature's
delete-based redesign).

**One large structural pull mid-session**: the top-level `app/{backend,frontend,portal}` folders
had been renamed to `app/{easycashbackend,lmsfrontend,portalfrontend}` by a commit already merged
before this session started, but this Mac's checkout still had a pending local reorg of its own
scripts. Handled by re-copying `.env` files into the new directory names and updating the 3
`.command` launcher scripts' internal paths to match.

**Root scripts moved into `scripts/`**: a later pull relocated every root `.bat`/`.command` file
(including this machine's own `Update LAN IP.command`, `Update Database From SDevTech.command`,
`Backfill SDevTech Attachments.command`) into `scripts/`. The git rename correctly carried over an
already-fixed `ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"` (the extra `/..` for the
new depth), but the executable bit was lost in the process on this checkout — reset with `chmod +x`
after every pull that touches these files.

## 2. Test account cleanup

At the user's request, purged 10 test `Borrower` records entirely — both Nomer's own (`TESTNOMER`,
`TEST2NOMER`, `TEST3NOMER`, `TEST4COB`, `TESTCONTACT`) and 5 other staff members' (`BHENZII TESTA`,
`JAY TEST`, `KABORROW TESTING`, `ROXANNE TESTONLY`, `TEST PAYLATER`) after explicit confirmation on
each batch. Cascading delete written as a single hand-built SQL transaction (temp tables of ids,
children deleted in FK-dependency order, borrowers last) rather than one-by-one API calls, since
several had real `ACTIVE` loan accounts with schedules/transactions/`payment_allocations` attached.
First attempt errored on a missed `payment_allocations` FK and rolled back cleanly with no partial
damage; second attempt (with that table added to the delete order) succeeded.

## 3. SDevTech re-sync + balance integrity follow-up

Ran the full `Update Database From SDevTech.command` pipeline against a newer legacy export
(migrate-legacy-data → migrate-repayment-schedules → recompute-active-loan-balances-from-schedule →
check-legacy-balance-integrity), interrupted once mid-run by an actual Mac shutdown and resumed
cleanly (every step in the pipeline is idempotent/resumable by design). The integrity check flagged
4 loans reading ₱0 `principalBalance` despite a genuine unpaid schedule balance — the known
"raw SDevTech record has no account-level balance snapshot at all" class of bug. 3 were already
covered by an existing one-off script (`backfill-newly-discovered-missing-balance-loans.ts`, just
never run against this machine's freshly-rebuilt database); the 4th (`SP-Easy_00001`) was new, so a
second small script (`backfill-newly-discovered-missing-balance-loans-2.ts`) was added rather than
extending the first (whose own doc comment explains why its specific 3 loans needed the fix —
mixing in an unrelated later discovery would blur that history).

Also ran `Backfill SDevTech Attachments.command` (SFTP credentials were missing from this machine's
`.env` — user supplied them, added under a new `SDEVTECH_SFTP_*` block) — 21,312 of 21,319
attachment files downloaded successfully.

## 4. Roles & Permissions seed gap

After a fresh migration run, every report/reports-adjacent page 403'd for the MIS role
("Could not load the transaction report") despite MIS normally being the super-user role. Root
cause: `prisma/seed.ts`'s permission list had grown from 12 (old colon-style codes like
`audit_log:read`) to 33 (new dot-style codes like `report.view`) across the commits already merged
into `origin/main`, but the seed script itself had never been re-run on this machine's rebuilt
database. Fixed by running `npx tsx prisma/seed.ts` directly (`npm run seed` failed with a
monorepo-path npm quirk, worked fine invoked directly) — safe to re-run, everything is
`upsert`-based.

## 5. LAN IP drift (recurring)

This machine's LAN IP changed at least three times across the session (`.50` → `.25`, plus an
earlier `.2` → `.50`), each time requiring the same manual fix `Update LAN IP.command` automates:
detect the current IP, replace only the old LAN-shaped `CORS_ORIGIN` entry (preserving the
`easycash-lms.pages.dev`/`easycash-portal.pages.dev` Cloudflare origins), update
`VITE_API_BASE_URL`, rebuild the frontend (IP is baked into the bundle at build time), restart the
backend (`CORS_ORIGIN` is a runtime env var, no rebuild needed). At the user's request, renamed the
script to `Update LAN IP (Macbook-Nomer).command` to match the existing `(Laptop-Nomer)` naming
convention on this machine's Windows sibling, since all three of the user's machines now have their
own differently-named copy.

## 6. SOA on-screen penalty computation table (the actual feature work)

User request, mockup shown first: display a per-installment penalty computation table in the
Create SOA dialog's COMPUTED mode, matching the shape of the user's own Excel reference tool
(FROM/TO/PRINCIPAL/INTEREST/DAYS LATE/PENALTY per row, totals row, plus a separate "Accrued
interest computation" section and a Total Obligation figure) — confirmed via `AskUserQuestion`
that this required a real backend change (the calculator only ever produced aggregate totals, no
per-row breakdown existed anywhere) before starting.

- **Backend** (`StatementOfAccountCalculator.ts`): added `PenaltyBreakdownRow[]` (one row per
  past-due installment that contributed to `pastDuePenalty`, populated under both `RECORDED` and
  `COMPUTED` modes, empty under `MANUAL` since there's no per-installment figure there) and a
  single-row `AccruedInterestBreakdown`, both returned alongside the existing scalar totals. Not
  yet persisted to the `GeneratedStatementOfAccount` record itself (would need new jsonb columns +
  a migration) — scoped to the live preview only for now.
- **Frontend** (`LoanDetailPage.tsx`): the Create SOA dialog already computed a full client-side
  mirror of the backend calculator for a live, no-round-trip preview as staff type dates
  (`soaPreview` memo) — ported the same row-collection logic into that existing duplicate rather
  than wiring a new backend preview endpoint, so the live-typing UX stays instant. Rendered as a
  collapsible `<details>` table under "Recompute every installment" (Penalty computation) and
  inside the Accrued Interest card (Accrued interest computation), both collapsed/hidden by default
  so a loan with a long schedule doesn't dominate the dialog.

**Bug found and fixed in the same feature**: the new default-date logic for Penalty From/To (and,
by extension, the pre-existing Accrued Interest "As of date" default) used
`date.toISOString().slice(0, 10)` to pre-fill the date inputs — reads the **UTC** calendar day, one
day earlier than the correct **Manila** day for any due date stored as Manila-midnight-as-
`T16:00:00Z` (the majority of this system's dates). Exactly the bug class `manilaTime.ts`/
`manilaDaysBetween` already exist to prevent, just newly reintroduced in a date-*formatting* path
rather than a day-*counting* one. Fixed by adding `manilaDateInputValue()` to `utils.ts` (same
+8-hour-shift-then-read-UTC-fields pattern as `manilaDaysBetween`) and using it everywhere a date
input gets a computed default in this dialog.

**Date-default rules, per user's explicit spec**:
- Penalty From date: the due date of the earliest installment that is not yet fully paid (any
  unpaid Principal + Interest > 0), regardless of whether it already has a penalty on record —
  simplified from the previous "earliest *blank* installment" rule, which silently fell back to
  installment #1's due date (paid or not) whenever every installment already had *some* recorded
  penalty.
- Penalty To date / Accrued Interest As-of date: the loan's maturity date once actually matured,
  otherwise today (Manila calendar day) — both re-applied every time the dialog opens, not just on
  first mount.

## Current state

- All changes verified: `npx tsc --noEmit` clean on both apps after every edit; backend suite run
  multiple times, consistently 947-948 passed / 24 pre-existing failures (confirmed via `git stash`
  to be present on `origin/main` before any of this session's edits — unrelated portal/borrower-
  repository test-mock gaps and an already-broken SOA penalty-rate test, not touched or introduced
  here); Docker rebuilt and healthy after every backend/frontend change.
- This machine's local database is now fully synced with the latest SDevTech export, has every
  pending migration applied, has a complete Roles & Permissions seed, and its `.env`/LAN IP config
  is current as of this session's end.

## Known follow-up work

- The SOA penalty/accrued breakdown is preview-only (not persisted on the generated SOA record) —
  if staff need to see the same table again later against an already-generated statement, that
  requires new `jsonb` columns on `GeneratedStatementOfAccount` plus a migration, not done here.
- The client-side `soaPreview` memo remains a second hand-maintained copy of
  `StatementOfAccountCalculator`'s logic (now three total copies of parts of this formula counting
  `RepaymentInstallmentPresenter`'s live figure) — flagged as an architecture smell worth resolving
  via a real backend preview endpoint at some point, not addressed this session (kept as-is to
  preserve the existing instant, no-round-trip preview UX).
- 24 pre-existing backend test failures (client-portal mocks, `PrismaBorrowerRepository` mocks, an
  `AccruedInterestCalculator`/`RepaymentInstallmentPresenter` penalty-rate mismatch, one already-
  broken `StatementOfAccountCalculator` test) remain unfixed — out of scope for this session, not
  introduced here, but worth a dedicated pass since they now number enough to hide a real
  regression among them.
