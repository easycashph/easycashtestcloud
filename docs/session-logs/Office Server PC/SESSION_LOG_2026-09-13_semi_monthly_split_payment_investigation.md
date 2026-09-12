# Session Log — 2026-09-13 — Semi-Monthly Split-Payment Investigation

**Machine:** Office Server PC
**Requested by:** Nomer Perez

## Summary

User noticed NOMER DELA CRUZ PEREZ (a test loan application, borrower has 3 real loan accounts:
SL-REG_00018, SL-REG_00054, SL-REG_00114) showed 0% on-time rate / 0 pts on the Internal Credit
Score's Payment History factor, despite having an active account, and asked why. Investigation
found a real, significant data-modeling gap - not a bug in the newly-shipped scoring feature.

## What was found

The Payment History computation (`BorrowerRiskSummaryService.summarize()`) is working exactly as
designed and coded: `installment.lastPaidAt <= installment.dueDate` per `repayment_schedules` row.
Verified this independently via a standalone script reproducing the exact same logic against the
live DB - confirmed 19 settled installments across his 3 loans, 0 on-time by this check.

**But the underlying data tells a more specific story**: every one of his installments is actually
paid via TWO partial payments (`loan_transactions` type REPAYMENT) roughly 14 days apart, each
paying half the installment amount (e.g. 2× ₱1,725.42 = ₱3,450.83 total due) - a semi-monthly
payroll/allotment deduction pattern. `repayment_schedules.lastPaidAt` records only when the
installment was FULLY settled (the later of the two partial payments), which lands ~13-15 days
after the single monthly due date even though the borrower's payroll-driven payments never
actually missed a cycle. User confirmed directly: "on time naman ang bayad" (the payments really
are on time) and later "tama ka, split payment ito" (confirmed it's split payment).

## Why this isn't a quick fix

Two candidate fixes were investigated and both found to be unsafe to ship without more work:

1. **Use the first partial payment's date instead of the final settlement date.** Would need a
   reliable link from each `loan_transactions` row to which `repayment_schedules` row it applies
   to - that's exactly what `payment_allocations` exists for. But `payment_allocations` has only
   **93 rows in the entire database** - almost no legacy/migrated loan (including all 3 of this
   borrower's) has real allocation records, only the aggregate `lastPaidAt`/`principalPaid` totals
   on the schedule row itself. No reliable schema-backed way to find "the first partial payment"
   for the loans that actually exhibit this pattern.

2. **Add a flat grace period (e.g. 15 days) before counting an installment as late.** Checked the
   `gracePeriodDays` field that already exists per `LoanAccount` (used for penalty calculation) -
   it's `0` for all three of this borrower's loans, so it isn't the right concept to reuse (it
   means something different: leniency before a penalty is charged, not "structural allowance for
   split payment reporting"). Tried a blanket day-count threshold instead: bucketed every
   late-paid installment system-wide by days-late (1-9 / 10-19 / 20+) crossed with loan product
   category (SL-/SML-/BL- prefix):

   | Product | 1-9 days | 10-19 days | 20+ days |
   |---|---|---|---|
   | Salary Loan (SL) | 330 | 435 | 366 |
   | Seafarer Loan (SML) | 471 | 166 | 457 |
   | Business Loan (BL) | 77 | 3 | 25 |

   The 10-19 day bucket (the suspected split-payment signature) is not cleanly isolated to Salary
   Loan, and even within Salary Loan it's a minority of that product's late-paid installments (435
   of 1,131). A blanket grace-period threshold would risk silently reclassifying real late payers
   as on-time across the whole platform, not just structurally-split semi-monthly payments -
   unacceptable for something that feeds credit risk scoring.

## Decision

**No code changed.** This affects risk-assessment accuracy platform-wide, not just one loan
application's display, so per CLAUDE.md ("never fabricate financial logic," "validate before
implementation") this needed more investigation than a single session had room for. Spawned a
background task (`task_41293745`) with the full investigation trail above, scoped to: check for a
semi-monthly/split-repayment concept already modeled on `LoanProduct`/`LoanAccount`, check whether
recently-originated (not legacy-migrated) loans have reliable `payment_allocations` data that a
partial fix could target safely, consider per-loan-account transaction-pattern matching instead of
a system-wide day-count rule, and confirm with the user whether Salary/Seafarer products are
contractually semi-monthly by design.

## Current state

- No code or data changed this session - purely diagnostic.
- `task_41293745` pending, not yet started.
- Worth flagging to any Loan Officer/CRM reviewing NOMER DELA CRUZ PEREZ or similar
  salary/seafarer-loan renewal applications in the meantime: a low/zero Payment History score on
  the Internal Credit Score may currently understate a borrower's real payment reliability if their
  loan is repaid via semi-monthly allotment/payroll deduction - worth a manual look at the actual
  transaction history rather than trusting the score at face value for these cases until the
  follow-up investigation lands.
