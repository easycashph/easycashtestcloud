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
