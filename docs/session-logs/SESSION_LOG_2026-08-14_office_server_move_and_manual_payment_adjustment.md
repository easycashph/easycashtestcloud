# Session Log: 2026-08-14 — Office Server PC housekeeping, auto-start, and the Manual Payment Adjustment tool

Continues `docs/session-logs/SESSION_LOG_2026-08-13_mitigation_details_and_reverse_payment.md`, whose
§2 ("Reverse Payment on migrated transactions — investigated, not yet built") is what §6 below
finally implements.

## 1. Repo moved to `E:\ECLC LMS CLAUDE CODE\easycash-lms`

Previously `E:\201_Files\ECLC CLAUDE CODE\easycash-lms` — moved out of the client-documents archive
(`E:\201_Files\`) into its own top-level folder, at the user's request.

Pre-move audit found nothing machine-path-dependent: `docker-compose.yml` uses only relative paths
(`../easycashbackend`), Postgres data lives in the named `postgres_data` Docker volume (unaffected by
where the repo sits), `.claude/launch.json` is relative, `backup-mongodb.bat` uses `%~dp0`, and no
Windows Scheduled Task referenced the old path.

**Gotcha**: `Move-Item` on the folder itself failed with "being used by another process" (the running
Claude Code session holds its own working directory). A rename-probe on each subfolder showed all
children were free — so the contents were moved individually and the empty shell left behind for the
user to delete after restarting. Worth remembering for any future repo move from inside a session.

Verified after the move: git branch/status unchanged (uncommitted work intact, 40 session logs),
`docker compose up -d` healthy from the new location, LMS/Portal HTTP 200, backend `/health` 200,
and the DB intact (4,608 borrowers / 1,803 loan accounts / 280,144 transactions / 24,213 attachments
/ 9 users), with the storage bind mount resolving to 24,187 files inside the container.

## 2. Deleted `backup-to-google-drive.ps1`

Hard-coded to `C:\ECLC CLAUDE CODE` and `C:\Users\EASYCASH\...` — neither exists on the Office
Server PC (users here are `Admin`/`Gary Manalo`/`Intern`/`PC-Admin`, repo is on `E:`). It belonged to
Nomer Laptop's setup, not this machine. `local/backup-database.ps1` (which uses `$PSScriptRoot`) is
the one that actually works here.

## 3. MongoDB backup run + `mongodump.exe` installed

`legacy/mongodb-tools/mongodump.exe` was missing (gitignored, never committed). User placed it; the
existing `backup-mongodb.bat` then ran clean against the remote SDevTech MongoDB
(`194.233.79.169:5200`): 525,018 `loan_transactions`, 234,181 `activities`, 205,961
`custom_field_values`, 43,417 `transaction_details` → `legacy/mongodb/142026_112045.zip` (107 MB).

## 4. Auto-start on boot (Docker + Cloudflare Tunnel)

Neither came back automatically after a restart. Both fixed:

- **Docker Desktop**: `%APPDATA%\Docker\settings-store.json` had `"AutoStart": false` — flipped to
  `true`. Verified by killing Docker Desktop and relaunching: all four containers returned on their
  own (`restart: unless-stopped`).
- **Cloudflare Tunnel**: registered a Scheduled Task `Easycash LMS - Cloudflare Tunnel AutoStart`
  (At logon, `SERVER-NAS\Admin`) running `Start Cloudflare Tunnel (Auto-Update).ps1 -Unattended`.
  That script needed two changes to survive an unattended run:
  1. New `-Unattended` switch + `Wait-Or-Exit` helper replacing every `Read-Host 'Press Enter to
     exit'` — under Task Scheduler there is nobody to answer a prompt, so a failure would have hung
     the task forever instead of exiting.
  2. The backend health check now **retries for up to 5 minutes** instead of failing on the first
     attempt — at boot, Docker Desktop and the containers are still starting when the task fires.
  Tested end to end: killed the running tunnel, started the task, confirmed cloudflared came up, the
  Pages `VITE_API_BASE_URL` was updated, a rebuild triggered, and `https://easycash-lms.pages.dev`
  returned 200.
- **Windows auto sign-in**: because "At logon" needs someone logged in, the user enabled
  `AutoAdminLogon` in `HKLM\...\Winlogon` themselves (the `netplwiz` checkbox was absent on this
  machine). Claude did not handle the password — it was typed by the user directly into regedit.
  **Security note recorded for the user**: this removes the Windows login barrier on a machine
  holding real borrower PII; physical/RDP access control matters more now.

## 5. Smaller items

- New `Backup LMS Database.bat` — a double-clickable wrapper (Filipino prompts, Docker-running check)
  around the existing `local/backup-database.ps1`, matching `Backfill SDevTech Attachments.bat`'s
  shape. Test run produced `easycash_20260814_130033.dump` (26 MB) + `storage_20260814_130033.tar.gz`
  (19 GB — the storage folder is genuinely 19.6 GB / 24,187 files, so a full backup takes ~40 min).
- New `backup-lms-database-remote.bat` (gitignored — plaintext DB password, same reasoning as
  `backup-mongodb.bat`). LAN-only `pg_dump` over `192.168.68.134:5432`, for running from another
  office machine. Database only — attachments aren't reachable over a Postgres connection.
  Deliberately **not** exposed through the Cloudflare Tunnel; putting the DB port on the public
  internet was considered and rejected.
- Portal loan application: auto-uppercased 7 name fields (first/middle/last, dependant name,
  co-borrower name, both character references) in `LoanApplicationFormPage.tsx`, matching the LMS-side
  fix that arrived in commit `75710e2`. The Portal had been left out of it.
- Investigated `ALDWIN JALA MANIWANG`'s PREDECLINED application. The displayed "distance from branch
  could not be verified" is **not** the reason — that check **fails open** by design
  (`LoanApplicationPreQualificationService.ts`, null distance is treated as passing). The real cause
  is a blank `monthlyIncome`; age 46 passes. Worth remembering when staff ask about a pre-decline:
  read all three checks, not the first one that looks like a complaint.

## 6. Manual Payment Adjustment feature (the main piece of work)

Closes the gap left open on 2026-08-13. `ReversePaymentUseCase` refuses any migrated payment with no
`PaymentAllocation` rows (`NoReversibleAllocationDataError`), and its message says "Use a manual
adjustment instead" — but **no such tool existed**. The user hit this on transaction
`58fe8b18-2264-4b20-9ec0-4a92b02878a1` (₱7,000, `SML-PDC_00035`) and, given the three options laid
out last session, chose to build the tool rather than take a one-off script.

Design deliberately mirrors the existing `ReversePaymentUseCase` / `ReducePenaltyUseCase` /
`AdjustFeesUseCase` patterns rather than inventing anything:

- **Schema**: new `PaymentAdjustment` model (`payment_adjustments`), one immutable row per
  (transaction, installment) corrected, storing previous+new paid amounts for all four components,
  a required `reason`, and `adjustedByUserId`. Migration
  `20260814071821_add_payment_adjustment` — purely additive (new table + indexes + FKs, nothing
  dropped or altered).
- **Domain**: `PaymentAdjustment` entity + `IPaymentAdjustmentRepository` /
  `PrismaPaymentAdjustmentRepository`, all shaped exactly like their `PaymentAllocation` siblings.
- **Use case**: `ManualPaymentAdjustmentUseCase` — replays staff-specified reductions through the
  *same* primitives Reverse Payment uses (`RepaymentInstallment.recordPayment()` with negated
  amounts, `LoanAccount.applyPayment()`), reopens a CLOSED loan whose settling payment was undone
  (same `SML-REG_00378` lesson), and writes an **`ADJUSTMENT`**-type `LoanTransaction` — *not*
  `REVERSAL`, so `reversesTransactionId` stays reserved for the precise automatic flow.
- **Three new guards** (`LedgerDomainErrors.ts`), covering what a human-typed correction needs that a
  replay of exact prior amounts does not:
  - `TransactionHasAllocationDataError` — the mirror image of `NoReversibleAllocationDataError`.
    A transaction that *does* have a breakdown must go through Reverse Payment; allowing both paths
    would let staff bypass the precise undo with a guess.
  - `PaymentAdjustmentExceedsPaidAmountError` — `recordPayment()` has no non-negative floor of its
    own, so this enforces one before calling it.
  - `EmptyPaymentAdjustmentError` — an adjustment must actually change something.
- **HTTP**: `POST /loan-accounts/:id/transactions/:transactionId/manual-adjust`, idempotency-keyed off
  the transaction id (same reasoning as reverse), gated by a new **`payment.manual_adjust`**
  permission — seeded MIS-only by default, matching `payment.reverse`'s safety-net posture.
- **Frontend**: when a reverse attempt is rejected with `NO_REVERSIBLE_ALLOCATION_DATA`, the reverse
  dialog now offers a **"Use Manual Adjustment instead"** button (previously a dead end — the message
  named a tool with no way to reach it). That opens a new dialog: per-line installment picker showing
  each installment's currently-paid total, four numeric inputs, "Add another installment" for a
  split, required reason, and a confirm button disabled until the entered amounts pass the same
  guards the backend enforces.

**Tests**: 11 new unit tests in `tests/unit/loan-account/ManualPaymentAdjustmentUseCase.test.ts`, all
passing — each guard plus four happy paths (single installment, multi-installment split, CLOSED-loan
reopen, all-zero lines ignored).

**Baseline note**: the suite has **10 pre-existing failures** unrelated to this work, in
`tests/unit/borrower/PrismaBorrowerRepository.test.ts` (mock is missing
`client.characterReference`, so production code's `.count()` call throws) and four
`tests/unit/client-portal/*` files (stale deps fixtures). These are stale test mocks, not product
bugs — worth fixing separately.

## 7. The real cause of SML-PDC_00035's ₱7,000 discrepancy — a missing step in `Update Database From SDevTech.bat`

**The Manual Adjustment tool turned out not to be what this loan needed.** Investigating whether the
loan could simply be re-migrated from a fresh SDevTech snapshot revealed the actual bug.

Fresh `mongodump` taken this session confirmed SDevTech still holds the ₱7,000 payment (₱5,309.86
principal + ₱1,690.14 interest) — it was never a duplicate or an error there. Comparing SDevTech's
`repayments` collection against Postgres' `repayment_schedules` showed the real mismatch:

| Installment #4 (due Aug 5) | SDevTech | LMS (before) |
| --- | --- | --- |
| principal paid | 5,309.86 | **0.00** |
| interest paid | 1,690.16 | **0.02** |
| fees paid | 936.00 | 936.00 |
| status | LATE | PARTIALLY_PAID |

(0.02 + the ₱7,000's 1,690.14 interest = 1,690.16 exactly — confirming the whole payment was the
thing missing.) The payment existed in `loan_transactions` but had never been applied to the
schedule.

**Root cause**: `Update Database From SDevTech.bat` ran `migrate-legacy-data.ts` and then
`recompute-active-loan-balances-from-schedule.ts`, but **never ran
`migrate-repayment-schedules.ts`** — which `legacy/Run Full Legacy Migration.command` has always had
as its step `[7/18]`, sitting between those two. So every run of that .bat imported new SDevTech
payments as transactions while leaving the installment-level paid amounts frozen, and then
recomputed account balances *from that stale schedule*, propagating the error up to the account
level. This affected far more than one loan.

**Fixed**: added the missing step to the .bat as `[6/8]` (renumbering 7→8 steps), with a comment
explaining the discovery so it isn't dropped again. Also corrected that file's own header text,
which claimed it "only adds new records, never changes existing data" — untrue; these scripts
deliberately re-sync existing loans, and the real safety property is that loans with a native
(non-legacy) `LoanTransaction` are skipped.

**Applied** (after taking `local/backups/pre_resync_20260814_162157.dump`):
`migrate-repayment-schedules.ts` (1,799 loans / 8,810 installments) then
`recompute-active-loan-balances-from-schedule.ts` (181 loans recomputed).

Verified afterwards for SML-PDC_00035 — every figure now matches SDevTech:
installment #4 principal paid 5,309.86 / interest 1,690.16 / status LATE; account-level
`principalPaid` 51,767.86, `principalBalance` 29,538.88, `interestPaid` 11,338.19,
`interestBalance` 865.09. Due dates confirmed correct too (May 5 / Jun 5 / Jul 5 / Aug 5 / Sep 5
Manila) — an earlier "off by one day" reading was a bad `AT TIME ZONE` in the diagnostic query, not
a data error (`dueDate` is a naive timestamp holding UTC, so it needs
`AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'`, not a single conversion).

**Whole-population verification** (not just the one loan): compared every migrated installment's
paid amounts in Postgres against the fresh dump — **8,810 compared, 8,796 exact matches, 0
unexpected mismatches**. The only 14 differences (across 12 loans) are all on loans locked by a
native LMS transaction, i.e. deliberately not overwritten: `SML-REG_00329`, `SML-REG_00330`,
`SML-REG_00361`, `SML-REG_00363`, `SML-REG_00369`, `SML-REG_00370`, `SL-CORP_00100`,
`SL-CORP_00103`, `SL-CORP_00105`, `SL-CORP_00106`, `SL-CORP_00114`, `SL-REG_00109`.

Schedule coverage: 1,799 of 1,800 migrated loans have a repayment schedule. The one without is
`SL-LAZ_00004-LEGACY2` (CLOSED, ₱1,000, one of the duplicate-loanCode `-LEGACY2` records) — noted,
not chased. Separately, 22,431 of the dump's 31,241 `repayments` rows are skipped by design: their
`parent_account_key` isn't in `loan_accounts.bson` at all (orphaned legacy rows), which is
long-standing filter behavior, not a regression from this session.

**Known remaining differences on this loan, both by design, not regressions**: installment #4's
`feesDue` (0.00 vs SDevTech's 936.00) and `penaltyDue` (0.00 vs 1,963.80). The schedule script's
`update` branch deliberately syncs only paid amounts/status/`lastPaidAt`, never the `*Due` columns —
those are the immutable per-loan snapshot. Penalty in particular is computed live here per ADR-050
rather than taken from SDevTech, which is the same divergence the outstanding ₱19.3M post-maturity
penalty question is about.

### Manual Payment Adjustment: not applied to any transaction

The feature is live and verified, but **no financial data was changed**. Read-only checks confirm
`58fe8b18-...` is exactly the intended case: REPAYMENT, migrated (`legacyId` set), 0 allocation rows,
not already reversed, ₱7,000 = ₱5,309.86 principal + ₱1,690.14 interest. But its loan's installments
don't map obviously to that ₱7,000 (1–3 are fully paid at much larger amounts; #4 holds only ₱0.02
interest + ₱936 fees; #5 is untouched) — **deciding which installment(s) that payment actually landed
on is a business judgment, not something to infer**, which is precisely why the tool asks staff
rather than guessing. Awaiting the user's decision on the specific figures.

## 8. Backfilled `PaymentAllocation` for migrated payments — Reverse Payment now works on 28% of them

Follow-up question: *can the allocation details be filled in for migrated payments at all?* The
2026-08-13 investigation had concluded no, on the basis that `LoanTransaction`'s aggregate
components were the only per-payment detail the export carried. That turned out to be incomplete.

**Found**: `loan_transactions` in the dump has a `parent_repayment_key` field — SDevTech's own
recorded link from a transaction to the exact `repayments` row it paid. Verified against real data
before relying on it: transaction `67340b103d54b136ae280008` (₱47,754.68 = ₱39,740.12 principal +
₱8,014.56 interest) points at an installment whose `principal_paid`/`interest_paid` are exactly
those two figures.

Ruled out as sources first: `transaction_details` (43,417 docs) holds only payment-channel data
(`transaction_channel_key`, `internal_transfer`), not allocations; `repayments` has no reference
back to a transaction; `payment_schedules.bson` is empty (0 bytes).

**New script** `scripts/backfill-payment-allocations.ts` (dry-run by default, `--apply` to write).
Purely additive — writes `PaymentAllocation` rows only, touching no balance, installment,
transaction, or loan account, so it cannot change any figure the LMS displays. Idempotent: skips any
transaction that already has an allocation. Requires a hop the field itself doesn't make obvious:
`parent_repayment_key` is a `repayments` **uid**, while `RepaymentSchedule.legacyId` is keyed off
that row's **`_id`**.

**Applied**: 2,697 allocations created across 512 loans. Migrated REPAYMENTs that are now reversible
through the normal precise flow: **2,697 of 9,496 (28.4%)**. Skipped 642 dangling keys and 23
transactions not present here. Post-check: the only allocations whose amounts don't equal their
transaction's components are 6 rows on 3 *native* transactions — correct behavior, those are real
LMS payments legitimately split across two installments each.

**Coverage is partial on purpose.** Roughly 91.5% of the dump's non-reversed legacy REPAYMENTs have
no `parent_repayment_key` (the field looks to have been added late in SDevTech's life). Deriving
those by replaying an allocation waterfall was considered and rejected again, for the same reason as
on 2026-08-13: guessing wrong silently reverses the wrong installment — the `SL-CORP_00114` class of
bug. Those stay on Manual Payment Adjustment, where a human picks the installment explicitly.

**Data-integrity finding**: the script's cross-loan safety check refused 9 transactions whose
`parent_repayment_key` pointed at an installment belonging to a *different* loan account —
`6758fb51db9f45777e6d06b0`, `67594c01db9f45777e6d10c5`, `67d0e14872fc294519988123`,
`67d0e2e672fc294519988154`, `69b90975bb9a9c2eebd76fd9`, `69e58c217004f4ba94895399`,
`6a0d2718a12cb7c31e39fd52`, `6a348d0cab1043df9efc1a79`, `6a6aedad0a657be341d23858`. These are
inconsistencies in SDevTech's own export, not something this migration introduced. Writing them
would have let a future Reverse Payment undo a payment against the wrong borrower's loan. Not
investigated further this session — worth a look alongside the 200 loans (§7 analysis) whose
transaction principal totals disagree with their schedule's principal-paid totals.

## 9. `FEE_REPAYMENT` / `PENALTY_REPAYMENT` — legacy payments were mislabelled as `ADJUSTMENT`

Found by comparing SDevTech's and the LMS's own Daily Collection Report exports for
`SML-PDC_00035` (Rafael Alarcon Baguio). SDevTech shows a **₱936 "Fee Repayment"** (OR 2471,
Aug 5, Bank Transfer); the LMS showed the same money, same OR number, as **"Adjustment"**.

**Root cause**: `TRANSACTION_TYPE_MAP` in `migrate-legacy-data.ts` collapsed SDevTech's 30 types
into this system's 10, and folded `FEE_REPAYMENT`/`PENALTY_REPAYMENT` into `ADJUSTMENT` alongside
genuine staff corrections (`WRITE_OFF`, `REPAYMENT_UNDO`, `*_DUE_REDUCED`, `*_ADJUSTMENT`). Those
are not the same kind of event: one is a real borrower payment, the other is a manual correction.
Collapsed together, they became indistinguishable in reports and audit trails, and any report
filtered to "Repayment" silently omitted real collections.

**Scope, measured before changing anything** (original SDevTech type recovered from the dump by
`legacyId`, for all 5,503 migrated `ADJUSTMENT` rows): only **50 rows (0.9%)** were actually
payments — 28 `PENALTY_REPAYMENT`, 22 `FEE_REPAYMENT`. The other 5,453 are genuine corrections
(2,895 `FEES_DUE_REDUCED`, 922 `PENALTY_ADJUSTMENT`, 670 `REPAYMENT_ADJUSTMENT`, …) and were
correctly mapped all along.

**Fix, in four parts:**
1. Two new `LoanTransactionType` enum values (migration `20260815003216_add_fee_penalty_repayment_types`,
   purely additive `ALTER TYPE … ADD VALUE`).
2. `TRANSACTION_TYPE_MAP` now maps them to themselves — **all future imports are correct**, so this
   can't recur via `Update Database From SDevTech.bat`.
3. New `scripts/relabel-legacy-repayment-transaction-types.ts` (dry-run by default, idempotent) for
   rows already in the database. Not a guess: each row's original type is read back from the dump
   and matched by `legacyId`, same technique as `backfill-payment-allocations.ts`. Applied — 50 rows
   relabelled. Only the `type` column is written; no amount, component, balance, installment, or
   allocation is touched, so no computed figure can change.
4. Report labels use SDevTech's own wording ("Fee Repayment"/"Penalty Repayment") so the two
   systems' Daily Collection Reports stay comparable line for line during the changeover — that
   comparison is exactly what surfaced this. Badges are green like `REPAYMENT` (real money in), not
   amber like `ADJUSTMENT`, and both types are selectable in the Transaction Report's type filter.

Verified for `SML-PDC_00035`: the ₱936 row is now `FEE_REPAYMENT` with OR 2471, matching SDevTech
exactly. System-wide: 22 `FEE_REPAYMENT` + 28 `PENALTY_REPAYMENT`.

**These two types are migration-only, by design** — recorded in the enum's own doc comment and
mirrored in every type definition. SDevTech splits one payment into a row per component; this
system does the opposite (TXN-1: one financial event, one row), with `ProcessPaymentUseCase`
recording a single `REPAYMENT` whose `feesComponent`/`penaltyComponent` carry the split and
`PaymentAllocation` holding the per-installment detail. Once SDevTech is retired, no new
`FEE_REPAYMENT` should ever be created.

**Follow-up surfaced, not yet built — there is no way to charge a fee in this system.** Evidence:
`applied_fees` and `fee_rules` are both empty (0 rows), nothing in `src/` ever constructs an
`AppliedFee`, and all 6,010 `FEE_CHARGED` transactions came from migration. The `AppliedFee`/
`FeeRule` models and the `FEE_CHARGED` type exist but are unimplemented. The only current
workaround is `AdjustFeesUseCase` (raise an installment's `feesDue`), which carries correction
semantics, links to no fee catalogue, and renders as an `ADJUSTMENT` row rather than a ledger
transaction. Worth building before SDevTech is retired, but it needs business input first (which
fees, fixed vs percentage, who may charge, installment- or loan-level) — flagged for the user, not
guessed at.

**Test baseline note**: the suite reports 11 failures across 6 files (borrower repository, client
portal, and one date-drifted `ReversePaymentUseCase` assertion expecting `PENDING` where the
installment now computes `LATE`). Confirmed pre-existing by stashing this session's work and
re-running: identical 11 failures. None are caused by anything in this log.

## 10. Comparing LMS vs SDevTech Daily Collection Reports — found a report bug, not new duplicates

User exported both systems' Daily Collection Reports and asked why the totals didn't match
(LMS 1,072,269.04 vs SDevTech 756,488.71 for overlapping dates). Investigated with a throwaway
exceljs comparison script (deleted after use).

Three causes, only one of them a real bug:
1. **Date range mismatch** — the two exports covered slightly different windows (LMS through
   08-14, SDevTech through 08-13). Not a bug.
2. **Fee/Penalty Repayment row-splitting** — SDevTech records one payment as two rows (fee +
   repayment); this system records one row with fee/penalty components. Already correctly handled
   by §9 above. Not a bug.
3. **Report double-counting already-reversed transactions** — the real bug. Initially misread as
   "34 new duplicate groups, ₱488,848.39" — turned out every one of the 15 recent "native +
   migrated" groups already had a `REVERSAL` transaction against it (the 2026-08-12 fix, ₱214,719.90,
   was already correctly done). The actual defect: `getDailyCollectionReport`/`listTransactions`
   never excluded a transaction that has since been reversed. Since `REVERSAL` isn't one of the
   default "Payments only" types, an already-reversed `REPAYMENT` kept showing as if still
   collected, with no offsetting row visible under the default filter — silently overstating every
   report that used it, permanently, for every reversal ever done.

**Fixed**: both `listTransactions` (raw SQL, `AND NOT EXISTS (... WHERE r."reversesTransactionId" =
lt.id)`) and `getDailyCollectionReport` (Prisma `reversedByTransaction: null`) now exclude any
transaction with an existing reversal, unconditionally (not tied to the type filter — a `REVERSAL`
can never itself be reversed, so this only ever removes the reversed original, never a correction
row). Verified against real data: SL-CORP_00100's August total dropped from 2 rows/16,548.12 to the
correct 1 row/8,274.06; the full August "Payments only" report went from 82 rows/1,072,269.04 to
65 rows/850,248.06.

**Separately found, NOT part of this fix**: 21 duplicate-looking groups (23 extra rows,
~₱274,128.49) where BOTH copies are migrated (no native side) — all dated 2023-2024, all created in
the original 2026-07-23 migration batch. Different shape from the native+migrated pattern (could be
genuine SDevTech-side duplicates, or a coincidence needing per-case verification) — flagged for
separate review, not touched this session.

Full backend suite after the report fix: unchanged baseline (11 failures, same files/tests as
before).

## 11. Two automated duplicate-prevention guards (user-confirmed: both hard block / automated)

Root cause behind §10's 15 reversed duplicates: the same real payment gets recorded twice during
the SDevTech/LMS transition — once natively by staff in the LMS, once in SDevTech (then pulled in
by the next `Update Database From SDevTech.bat` run). The 2026-08-12 log already flagged this as an
open follow-up ("worth considering whether a standing 'possible duplicate' warning belongs in the
Payment Recording flow itself"). Built both directions now:

**A. Payment Recording hard block** (`ProcessPaymentUseCase`, new
`PossibleDuplicatePaymentError`/`findPossibleMigratedDuplicate`): before any allocation/mutation
work, checks whether a migrated (`legacyId` set) `REPAYMENT` already exists on this loan for the
*exact* same amount on the *exact* same Asia/Manila calendar day. Match is deliberately narrow —
loan + amount + day, nothing fuzzier — so a recurring installment's repeating amortization amount
on a *different* day is never falsely blocked. User-confirmed: hard block, no override in this
flow; a genuine same-day/same-amount collision (rare) needs a developer/DB-level look, not a UI
bypass. Frontend: the 409 `POSSIBLE_DUPLICATE_PAYMENT` code is now special-cased in
`PaymentRecordingPage.tsx` ahead of the existing generic-409 handler (which would otherwise have
masked this specific message behind "this loan was just updated by another action"). Two new tests
cover the block and the two ways it must NOT fire (different amount, different day).

**B. Migration-time automated skip** (`migrate-legacy-data.ts`): preloads every native
(`legacyId IS NULL`) `REPAYMENT`'s (loanAccount, amount, Manila day) signature once before the
transaction loop — same exact-match rule as (A) — and skips inserting a newly-seen legacy
transaction (one whose `legacyId` isn't already in the database) that matches one, recording it via
the existing `recordSkip`/reconciliation-summary mechanism (`possible duplicate of a native
REPAYMENT ... legacy _id ...`) rather than silently creating it. Already-migrated rows (re-run
refreshing OR/AR/channel) are unaffected — the check only applies to genuinely new legacyIds. Dry
run against the current dump: 525,032 read, 280,142 migrated, same reconciliation shape as before
this change (no regression; no new collisions in the current snapshot, expected since the 15 known
ones are already migrated and therefore excluded from the "genuinely new" check).

Full backend suite after both guards: 949 passed (+2 from the new tests), same 11 pre-existing
failures, no new ones.

## 12. Live-data correction: OR/AR mix-up between two borrowers

Cross-checking a full-August-range LMS-vs-SDevTech Daily Collection Report comparison (with §10's
report fix and §11's row-splitting both already live) surfaced one remaining real error: two
different borrowers' native payments shared the same OR/AR number.

| | Amount | Wrong (in LMS) | Correct (per SDevTech) |
| --- | --- | --- | --- |
| Mary Jane Dula Gorpido (`SL-REG_00103`) | 3,483.07 | OR 2501 / AR 20788 | OR 2499 / AR 20787 |
| Marlon Granados Guzman (`SML-REG_00355`) | 27,249.43 | OR 2501 / AR 20788 | OR 2500 / AR 20788 |

Investigated first whether this was the "already migrated, staff re-entered it" scenario §11's
guards protect against — it wasn't: both rows are native (`legacyId` null), same
`postedByUserId`, entered a full day apart (Mary Jane 08-13 06:56 UTC, Marlon 08-14 06:34 UTC).
Two genuinely different real payments, just typed with the same receipt number — most likely a
copy-paste of the previous entry's OR/AR instead of the correct one.

Corrected via a direct, precisely-scoped `UPDATE ... WHERE id = '<transaction-id>'` (two
statements, one per row) — metadata-only (`orNumber`/`arNumber`), no amount/type/balance/
installment touched, so no domain method or use case applies here (same class of fix as the
OR/AR/Channel backfill documented in the 2026-08-12 session log). Verified via a follow-up SELECT
matching the corrected values exactly.

**Broader gap explained, not a new bug**: after this fix and §11's row-splitting, the remaining
LMS-vs-SDevTech peso difference over Aug 1-14 is fully accounted for by non-bug causes: (a) a small
number of native payments entered into the LMS a day after the actual SDevTech-recorded collection
date (staff defaulting the Record Payment date field to "today" instead of backdating — an
operational note, not a code fix), and (b) 4 `SL-CORP_*` "Loan Deduct"-channel transactions that
are genuinely migrated (real SDevTech data, `legacyId` set) but don't appear in SDevTech's own
Daily Collection Report export — likely that report excludes the Loan Deduct channel on SDevTech's
side, not an LMS defect.

## 13. Row-splitting for the Daily Collection Report, matching SDevTech's exact shape

User clarified the reason a Repayment/Fee Repayment/Penalty Repayment split matters:
SDevTech's own Daily Collection Report always puts principal+interest on one row and
fees/penalty on their own separate rows, because that report is consumed downstream for other
purposes — the row shape itself is a real requirement, not cosmetic.

`getDailyCollectionReport` now splits a native REPAYMENT transaction (which carries all four
components on one stored row, per TXN-1) into up to three OUTPUT rows: `Repayment`
(principal+interest), `Fee Repayment`, `Penalty Repayment` — each skipped when its amount is
zero. Storage is unchanged; only this report's presentation splits. Already-separate migrated
FEE_REPAYMENT/PENALTY_REPAYMENT rows pass through unchanged (never split again). The type filter
now applies to the split output rows, not the stored transaction type — otherwise selecting "Fee
Repayment" alone would miss every native payment's fee portion.

Verified: Marlon Granados Guzman's ₱27,249.43 payment now shows as ₱24,963.90 Repayment +
₱2,285.53 Fee Repayment, matching SDevTech exactly.

## 14. Live-data correction: 8 native transactions' entryDate lagged SDevTech by one day

Comparing a fresh SDevTech Aug 1-14 export against live LMS data (post §10/§11/§12/§13 fixes)
surfaced 8 remaining native (non-migrated) REPAYMENT transactions where the LMS `entryDate` was
one calendar day later than the real collection date recorded in SDevTech — e.g. Alex Galay
Enero's ₱2,000 payment: SDevTech shows Aug 13, LMS showed Aug 14.

Root cause: staff record a payment in SDevTech on the actual collection day, then batch-enter it
into the LMS a day (or more) later, and the Record Payment form's date field defaults to "today"
rather than being backdated to the true collection date. Confirmed via `createdAt` timestamps —
e.g. Alex Galay Enero's transaction was `createdAt` 2026-08-14 06:45 (2:45pm Manila) with
`entryDate` also 2026-08-14, while SDevTech's own record of the same collection is dated Aug 13.
Not a code bug — an operational data-entry timing gap.

Corrected per user's explicit request ("sundin ang entries sa SDEV"), scoped narrowly to these 8
already-identified transactions: `LoanTransaction.entryDate` shifted back one day to match
SDevTech, AND the paired `RepaymentSchedule.lastPaidAt` (found via `PaymentAllocation`) shifted
identically — guarded so an installment's `lastPaidAt` was only touched if it exactly equaled the
transaction's OLD (wrong) date first, so a later, unrelated payment on the same installment could
never be clobbered. All 8 corrections applied cleanly, no skips.

Affected: `BL-REG_00061` (Edgardo De Vera Flores, ₱87,839.07, Aug 13→12), and seven Aug 14→13
corrections: `SL-REG_00070` (Ramil Rosas Torres), `SL-REG_00071` (Alfredo Desabille Ogana),
`SL-REG_00100` (Rosan Cruz Cinco), `SL-REG_00101` (Liezel Juban Pentecostes), `SL-REG_00104`
(Joseph Dela Cruz De Galicia), `SL-REG_00114` (Nomer Dela Cruz Perez), `SML-MAX_Y8Y4J` (Alex
Galay Enero).

**Deliberately not touched**, per user's own clarification that LMS is in a parallel-test period
with SDevTech still the authoritative system of record: the 21 "both-migrated" duplicate-looking
groups from §7/investigated further this session. Checked and ruled out one hypothesis (that
these are SDevTech's own principal+interest/fee/penalty row-split, matching §13's design) — all
44 rows across the 21 groups are plain `REPAYMENT` type on both sides, not REPAYMENT+FEE_REPAYMENT
pairs, so that theory doesn't hold. 18 of the 21 groups show a clear "bulk historical backfill"
signature (different real entry_date months, same creation session) and are almost certainly
distinct real payments that reused a stale OR/AR number during backfill — none are from Aug 2026,
all are 2023-2024 data migrated in the original 2026-07-23 batch. The remaining 3 groups
(`SL-CORP_E1V9O`, `SL-CORP_A7G0T`, both 2023-10-06; `SML-REG_00370`, 2026-08-05, the only recent
one) show a suspicious same-amount/same-entry_date/created-within-under-a-minute signature closer
to an accidental double-submission in SDevTech itself — flagged for the user to verify against
SDevTech/paper records before any action, not resolved this session. Recommended a permanent,
reusable LMS-vs-SDevTech comparison script (not yet built) for ongoing verification instead of
one-off analysis each time.

## 15. Multi-select channel filter + merging duplicate-looking channel labels

Following the channel exclusion the user needed to reconcile Aug 1-14 totals, built the same
multi-select pattern the type filter already has: a checkbox dropdown, applied to both the
on-screen Transaction Report and the "Download report" export.

**Bug found and fixed while building it**: the stored `paymentMethod` column mixes two
conventions — `ProcessPaymentUseCase` (native payments) stores the raw uppercase
`ACTIVE_PAYMENT_METHODS` code (e.g. `BANK_TRANSFER`), while migrated SDevTech rows store their
own already-readable channel name (e.g. `Bank Transfer`). Verified via a live query that each
duplicate-looking pair (`CASH`/`Cash`, `BANK_TRANSFER`/`Bank Transfer`, `PDC`/`Post Dated Checks`,
`UNEARNED_INCOME`/`Unearned Income`) splits 100% native vs 100% migrated with zero overlap,
confirming they're really the same real-world channel recorded two different ways — not a guess.
This was a pre-existing display bug in the Channel report column itself (a native
`BANK_TRANSFER` row showed literally that, unresolved), not just something the new filter
surfaced.

Fixed by expanding `PAYMENT_METHOD_LABEL` to cover every `ACTIVE_PAYMENT_METHODS`/
`DISCONTINUED_PAYMENT_METHODS` code (previously only 5 of ~20), each mapped to the exact label
its migrated counterpart already uses. `ChannelOption` changed from one-raw-value-per-option to
`{ label, values[] }` so `listDistinctChannels()` groups raw values by resolved label — 18 raw
stored values collapsed to 14 correct filter options. Frontend tracks selection by label and
expands to every underlying raw value when building `channel` query params.

New endpoint `GET /reports/transactions/channels` (`ListDistinctChannelsUseCase`) powers the
dropdown dynamically, since `paymentMethod` has no fixed schema enum to enumerate from.

Verified end to end: excluding the merged "Loan Deduct" option from Aug 1-14 brings the LMS
Daily Collection Report to 63 rows / ₱756,488.71 — an exact match to SDevTech's own report for
the same range, confirming every other fix this session (row-splitting, reversed-transaction
exclusion, OR/AR correction, entryDate correction) reconciles correctly together.

## 16. Confirmed: the migration-time duplicate guard (§11) covers the pattern that caused this

User asked directly whether updating the LMS from SDevTech again would recreate the
native+migrated duplicate pattern investigated in §10/§11. Confirmed it's already covered:
`migrate-legacy-data.ts`'s pre-loaded native-signature check (added §11, before any of this
session's later work) skips inserting a newly-seen migrated transaction that matches an existing
native REPAYMENT's (loan, amount, Manila day) — exactly the shape of all 15 duplicates found and
reversed in this session and the 2026-08-12 predecessor. Does not cover (by design, out of
scope): the 21 older both-migrated 2023-2024 groups from §7/§14, which predate this guard and are
a different shape (no native side at all).

## 17. CLAUDE.md updated: auto-rebuild Docker after code changes

User asked to always rebuild affected Docker containers automatically after a backend/frontend
change, without being asked each time. Added a short "Docker Rebuild" note under Development
Workflow in `CLAUDE.md` so this persists across sessions, not just this one.
