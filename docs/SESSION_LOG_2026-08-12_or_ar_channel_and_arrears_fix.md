# Session Log: 2026-08-12 — OR/AR/Channel migration backfill + stuck arrears fix

Continuation of the same day covered by `docs/SESSION_LOG_2026-08-09_to_2026-08-12.md` (which ends
at commit `76eb20c`). This log picks up right after: investigating why the Transaction Report shows
blank OR Number/AR Number/Channel columns, tracing that all the way to a real fix, and a second,
unrelated bug found and fixed along the way (loans stuck showing "In Arrears" forever).

## 1. "Bakit blangko ang OR number, AR number, Channel sa Transaction Report?"

Investigated the full pipeline (backend query, presenter, frontend rendering) — found no bug in the
code itself. Root cause was the underlying data:

- **9,384 of 9,510** REPAYMENT transactions (98%) came from the 2026-07-23 SDevTech/Mambu bulk
  migration. Inspected the raw legacy MongoDB dump's `loan_transactions.bson` directly (~525k docs,
  45 distinct field names) — genuinely no OR#/AR#/channel field exists on that collection.
- The remaining real, staff-entered payments (via Payment Recording page) mostly do have Channel
  filled (CASH/BANK_TRANSFER), OR/AR filled per teller's choice — working as designed.
- Conclusion at the time: not a bug, just migrated data that never had this info to begin with.

## 2. User supplied a fresh SDevTech export — the data DOES exist after all

User provided a newer legacy MongoDB dump
(`legacy/mongodb/20260812_143354.zip`) and separately a **SDevTech-native "Daily Collection Report
(July 2026).xlsx"** export (real screenshot-equivalent report straight from the old system).

- The July report's own columns (Full Name, Product ID, Account ID, ..., OR Number, AR Number,
  Channel, Type) showed **100% Channel coverage** (157/157 rows) and majority OR (54.8%)/AR (66.2%)
  coverage — proof the data exists somewhere in SDevTech, just not carried over.
- Cross-referenced 3 exact rows from that report (matching loanCode + date + amount) against our own
  database — confirmed those same transactions sit in our DB today with **all three fields blank**.
- Re-inspected the new zip's fuller collection list — found two collections absent from earlier
  investigation: `transaction_channels` (16-row lookup: Cash/Bank Transfer/ATM/Check/Dragonpay/
  Gcash/etc.) and `transaction_details` (43,404 rows, links a transaction to a channel via
  `loan_transactions.details_encoded_oid -> transaction_details.uid -> transaction_channel_key`).
  Coverage check: **81.3%** of REPAYMENT transactions resolvable to a channel name this way.
- OR/AR numbers turned out to be stored as **custom fields** (`custom_field_values`, 205,928 rows,
  linked by `parent_key == loan_transactions.uid`) rather than native columns — two custom field
  keys stood out as sequential-integer series. Definitively resolved which was which by tracing the
  exact two transactions from the July report (SML-PDC_X9X6S ₱5,000 repayment → OR 2379/AR 20649;
  SML-MAX_O3M8V ₱1,000 repayment → OR 2380/AR 20650) through the raw dump — both custom-field values
  matched exactly:
  - `8a8e8f8f815c2b190181602dc7345763` = **OR Number**
  - `8a8e8efa81ead99e0181efde2b034e5e` = **AR Number**

## 3. Migration script updated to pull all three fields

User confirmed: update `scripts/migrate-legacy-data.ts` (and by extension `Update Database From
SDevTech.bat`, which just calls that script) rather than write a separate one-off backfill.

- Added `loadTransactionEnrichment()`: preloads `transaction_channels` → name, `transaction_details`
  → channel-by-details-uid, and `custom_field_values` (filtered to the two known keys) →
  OR/AR-by-transaction-uid, all as in-memory Maps built once before the main 524k-row loop.
- Per-transaction resolution: `channel = channelNameByDetailsUid.get(tx.details_encoded_oid)`,
  `orNumber`/`arNumber` from the two Maps keyed by `tx.uid`.
- **Backfills already-migrated rows too**: changed the upsert's `update: {}` (previously a no-op on
  every re-run, by design, to avoid clobbering other fields) to
  `update: { orNumber, arNumber, paymentMethod }` — Prisma skips `undefined` values in an update
  payload rather than clearing the column (same mechanism as the `lastPaidAt` bug fixed earlier this
  day, but here it's the *desired* behavior: "not found this run" never clobbers a value a previous
  run already wrote).
- Verified via a standalone coverage script against the full 2026-08-12 dump before touching the
  live DB: 27,408/33,706 REPAYMENT transactions (81.3%) resolvable to Channel, ~4,400-4,600 to
  OR/AR — consistent with the two-transaction hand-verification.
- `npx tsc --noEmit` clean; dry run (`migrate-legacy-data.ts`, no `--apply`) completed cleanly
  against the full dump (280,098 transactions previewed, zero errors) before any write.

## 4. Investigation #2: "Bakit naka In Arrears samantalang updated na ang payment?"

User reported `SL-CORP_00114` stuck showing "In Arrears" despite a fully current repayment
schedule (both due installments PAID, next installment not yet due). Traced:

- The account has exactly one **real, staff-entered** payment (₱3,265.88, 2026-08-04, via Payment
  Recording page, AR# 20750, CASH) — this "locks" the account from the migration's legacy resync
  (an existing, correct 2026-08-03 safeguard: once real activity exists in the new system, the
  legacy migration must never again overwrite that loan's status/balances).
- Root cause: **nothing in the entire codebase ever transitions a loan back from
  `ACTIVE_IN_ARREARS` to `ACTIVE`** once it catches up. `ProcessPaymentUseCase` already auto-closes a
  fully-paid loan, but has no equivalent for "still owing, but no longer late." This was actually
  already flagged in an earlier 2026-07-12 fix's doc comment on `PrismaDashboardRepository` ("nothing
  in this codebase ever transitions a loan into that status" — the Dashboard worked around it by
  computing arrears live instead of trusting the stored column; every other screen, including the
  Loan Detail page's status badge, still reads the stale stored column directly).
- Quantified real impact: only **3 accounts total** are both (a) locked from legacy resync and
  (b) currently `ACTIVE_IN_ARREARS` with zero actually-late installments — `SL-CORP_00114`,
  `SL-CORP_00100`, `SL-CORP_00103`. Small, contained blast radius.

### Fix (user-confirmed: fix the 3 accounts AND add a permanent fix)

- `LoanAccount.markCurrent()` (new domain method) — mechanical `ACTIVE_IN_ARREARS -> ACTIVE`
  transition, mirroring `close()`'s existing pattern.
- `ProcessPaymentUseCase`: after applying a payment, if the loan is `ACTIVE_IN_ARREARS` and no
  installment is `LATE` anymore (same status derivation `RepaymentInstallment.status` already uses),
  calls `markCurrent()`. Placed as an `else if` alongside the existing fully-paid auto-close check.
- One-off live-data fix: the 3 accounts flipped to `ACTIVE` via a script with a built-in safety
  check (re-verifies no installment is genuinely late before writing, aborts otherwise) — all 3
  passed and were corrected.

## 5. Migration applied for real

With both fixes in place, ran the actual workflow (matching `Update Database From SDevTech.bat`'s
steps, done by hand since the user asked me to run it):

1. `npx tsx scripts/migrate-legacy-data.ts --apply` — 280,098 transactions migrated, 0 errors.
   Spot-checked the two known-good transactions post-apply: both now show the exact expected
   OR/AR/Channel values. Full-table coverage after apply: 8,131/9,515 REPAYMENT transactions with
   Channel (85.4%, up from ~9 before), 3,050 with OR, 3,099 with AR.
2. `npx tsx scripts/recompute-active-loan-balances-from-schedule.ts` — 179 accounts recomputed from
   real schedule data, 0 left untouched due to missing schedule rows.
3. `npx tsx scripts/check-legacy-balance-integrity.ts` — clean, 0 issues on both spot-checks (₱0
   principalBalance-despite-unpaid-schedule, and missing-schedule-rows-entirely).
4. The 3 stuck-arrears accounts fixed (see §4).

## Verification

- `npx tsc --noEmit` clean on backend after every change.
- `npx vitest run` (backend): matched the known baseline (5 failed files/135 passed/1 skipped, 10
  failed/892 passed/7 skipped) both before and after applying the migration — zero regressions.
  `ProcessPaymentUseCase.test.ts` specifically re-run in isolation too (20/20 passed) after adding
  the `markCurrent()` call.
- Docker rebuilt (`easycashbackend`), confirmed healthy via `docker compose ps`.
- All scratch investigation/verification scripts (dozen or so `inspect-*.ts`/`check-*.ts`/
  `verify-*.ts` one-offs used to explore the BSON dumps and cross-reference data) deleted after use
  — none committed.

## Current state / known follow-up

- Both fixes committed and pushed to `origin/main` as a single commit (`dde6bc9`), after amending
  onto an earlier same-commit push to include the `Co-Authored-By` trailer.
- OR/AR/Channel coverage is now real but still partial by nature of the source data (only ~32-33%
  of all REPAYMENT transactions have OR/AR, ~85% have Channel) — this reflects what the legacy
  system actually recorded, not a remaining migration gap. Re-running the migration against a future
  newer SDevTech snapshot will keep backfilling any additional transactions that gain these fields
  over there.
- The `ACTIVE_IN_ARREARS` stored-column reliability gap is now fixed going forward for any loan with
  real (non-legacy) payment activity — loans still fully governed by legacy resync will keep getting
  their status corrected by the migration script itself (reads `accountState` fresh every run), so
  between the two mechanisms no loan should get permanently stuck again. Worth keeping an eye on,
  since this was a genuinely subtle, previously-undiscovered gap (present since arrears status
  tracking was first introduced) that only surfaced because a small number of loans had switched
  over to native LMS payment recording.
- User asked about cross-device continuity: clarified that code fixes sync via `git pull`, but the
  actual database changes (the backfilled OR/AR/Channel, the 3 corrected accounts, the balance
  recomputes) live only in this machine's local Postgres — not part of git, not part of the Google
  Drive backup (which only covers the working folder's files, not the Docker Postgres volume). A
  `pg_dump`/restore would be needed to carry the data itself to another device.

## 6. Duplicate payment discovery — 15 real double-counted payments found and reversed

While the user was about to record a payment on `SML-PDC_00035` (₱7,000, RAFAEL ALARCON BAGUIO,
OR#2495/AR#20783) through the Payment Recording page, they asked why that confirmation dialog
looked the way it did. Checked the database directly — that exact transaction (same loan, amount,
OR#, AR#, date) already existed, migrated from SDevTech just earlier this session. User did not
submit it; asked instead to check the whole database for the same pattern.

- Wrote a scan comparing every native (non-legacy, `legacyId: null`) REPAYMENT transaction against
  legacy-migrated REPAYMENT transactions on the *same loan account*, same amount, within a 3-day
  window (legacy entries carry a UTC-midnight date, native entries a local-midnight date — a
  1-day offset is the same real calendar day, not a coincidence-breaker).
- Result: **15 of 19** native transactions matched a legacy one — same loan, same amount, same
  OR#/AR# where present. This is staff having recorded the same real-world payment twice: once
  directly into SDevTech (now migrated here), and again by hand into the LMS's own Payment
  Recording page. `SML-REG_00370` (Armando Abes) had it happen twice over for two different
  payments — 3 of the 15 duplicates belong to that one loan alone.
- Total double-counted exposure: **₱214,719.90** across 14 loans, 15 transactions - every affected
  client's balance was understated by the duplicated amount until reversed.
- User decision: keep the migrated/legacy copy as the source of truth, reverse the native
  duplicates.
- Reversed all 15 via the existing `ReversePaymentUseCase` (never a raw delete - TXN-1 append-only:
  each reversal is its own `REVERSAL` transaction, linked via `reversesTransactionId`, with a
  recorded reason "Duplicate entry - already recorded via SDevTech migration..."). Attributed to
  the real MIS user account this session operates under (a fabricated `postedByUserId` would have
  violated the real FK to `User`). All 15 succeeded; loan balances and statuses recalculated
  correctly (e.g. `SL-CORP_00114` - one of the 3 arrears accounts from §4 - now shows the correct
  higher outstanding balance with the duplicate backed out).
- Re-ran `check-legacy-balance-integrity.ts` after the reversals: still clean, 0 issues.
- Full backend `vitest run` after the reversals: same baseline (5 failed files/135 passed),
  unaffected.
- Purely a live-data correction, not a code change - nothing to commit for this section.

## Current state / known follow-up (updated)

- The duplicate-detection pattern (same loan + amount + OR/AR within a few days, one native one
  legacy) is a one-off scan script, not a permanent feature - worth considering whether a
  standing "possible duplicate" warning belongs in the Payment Recording flow itself (the
  triggering moment for this whole investigation was the user almost re-entering `SML-PDC_00035`'s
  payment a second time), rather than relying on someone noticing and asking.
- Not yet checked: whether any of the 4 native transactions that did *not* match a legacy one are
  themselves legitimate (no reason to suspect otherwise, just not specifically re-verified).
