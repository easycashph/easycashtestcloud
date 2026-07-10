# CP12 Follow-up #3/#4 — Real Repayment Schedule Data Found and Migrated

**Date:** 2026-07-09
**Scripts:**
- `app/backend/scripts/migrate-repayment-schedules.ts` (`npx tsx scripts/migrate-repayment-schedules.ts [--dry-run]`)
- `app/backend/scripts/recompute-active-loan-balances-from-schedule.ts` (`npx tsx scripts/recompute-active-loan-balances-from-schedule.ts [--dry-run]`)

## Background

The original CP12 migration (`docs/Architecture/CP12-legacy-migration-report.md`) reported
`RepaymentSchedule` as un-migratable because the legacy collection it checked,
`payment_schedules.bson`, is genuinely empty (0 documents) in this export.

A first attempt at fixing the 191 ACTIVE/ACTIVE_IN_ARREARS loans flagged with missing balance data
(`reconstruct-active-loan-balances.ts`, since deleted — never run for real, dry-run only) tried to
infer balances from the loan transaction ledger's running `balance` field plus the account-level
`feesDue` field. This produced a mathematically impossible (negative) result for 100 of 189 loans
(53%), which turned out to mean the underlying assumption — that `feesDue` represents currently-
outstanding fees — was wrong for this population.

## The real fix

The user provided a screenshot of the actual legacy production system's own Payment Schedule tab
for a real loan (loan code `SML-MAX_00002`; borrower name withheld from this document — real PII,
never committed to git history even in documentation), showing genuine per-installment
Principal/Interest/Fees/Penalty **Expected/Paid/Due** figures. Cross-checking this against the
legacy MongoDB export found the real source: **`repayments.bson`, 31,106 documents** — a
completely different, previously-unchecked collection from `payment_schedules.bson`.

Verification (all four totals matched the screenshot exactly):

| | Screenshot (real system) | Computed from `repayments.bson` |
|---|---|---|
| Principal Due | ₱96,002.22 | ₱96,002.22 |
| Interest Due | ₱0.00 | ₱0.00 |
| Fees Due | ₱0.00 | ₱0.00 |
| Penalty Due | ₱8,325.17 | ₱8,325.17 |

## What was done

1. **`migrate-repayment-schedules.ts`** — migrated `repayments.bson` into `RepaymentSchedule`
   (previously empty, 0 rows). Installment ordering: sorted by `due_date` ascending per loan
   (confirmed zero duplicate due-dates within any loan; the legacy `index` field, present on only
   ~16% of records, agrees with this ordering wherever it exists). Idempotent (upsert on
   `legacyId`), read-only against the legacy source.
   - **Result:** 8,746 installments migrated, covering 1,789 of 1,805 loan accounts (only 15
     loans — the same ones already unmatched from the original CP12 migration — have no
     installments). Of 31,106 total legacy `repayments.bson` records, 22,312 (71.7%) reference
     loan accounts absent from this particular export (the same "orphaned history" pattern already
     documented for `loan_transactions.bson` in the original CP12 report) and were correctly
     skipped, not fabricated.
2. **`recompute-active-loan-balances-from-schedule.ts`** — for the 189 (of 191) ACTIVE/
   ACTIVE_IN_ARREARS loans flagged by `flag-missing-balance-loans.ts` that now have migrated
   schedule rows, recomputed `principalBalance`/`interestBalance`/`feesBalance`/`penaltyBalance`
   (and the matching `*Paid`/`*Due` columns) as `SUM(installment due) − SUM(installment paid)` per
   component, across that loan's real `RepaymentSchedule` rows. No inference, no allocation-order
   guessing — every figure is a direct sum of real, migrated data.
   - **Result:** 189 loans recomputed. The 2 loans from the original 191 that aren't in this count
     were already excluded earlier (no matching `LoanAccount` row at all — part of CP12's original
     15 unmatched loans).

## Scope note

Deliberately limited to ACTIVE/ACTIVE_IN_ARREARS loans — a CLOSED loan reading 0.00 is plausible
(paid off) and wasn't the problem being solved (per user direction, 2026-07-09). The `Repayment
Schedule` migration itself (step 1) benefits every loan with legacy installment data, not just
those 189 — e.g. the Loan Detail page's "Repayment Schedule" tab now shows real data for any
covered loan, not only the ones whose account-level balance was also fixed.

## Known follow-up (not done here)

The ~424 non-active loans still flagged with `legacyBalanceDataMissing = true` (mostly CLOSED)
were not touched — their 0.00 balance is plausible as-is, but could be cross-validated against
their own `RepaymentSchedule` rows (now migrated) the same way, if ever needed. Separately, the
1,181 loans that were *not* flagged (i.e. already had an account-level balance snapshot from the
original migration) were not cross-checked against this newly-migrated schedule data — it's
possible, though unconfirmed, that some of those pre-existing snapshots disagree with what the
schedule data implies; this was out of scope for the specific problem raised today.
