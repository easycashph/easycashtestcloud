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

## Resolved same day - user proposed the actual fix

After this log's initial write-up, the user proposed a cleaner test: is a Salary Loan installment
fully paid before the NEXT installment's own due date? Verified against Nomer Perez's full payment
history via a `LEAD()` window-function query - **16 of 16 non-final installments** (excluding the
final installment of each loan, which has no "next" due date to lean on) landed before the next
installment's due date, confirming this is a reliable, non-arbitrary signal, unlike a flat day-count
grace period (which the earlier system-wide bucket analysis in this log showed couldn't safely
distinguish structural split-payment from genuine lateness).

User explicitly scoped the fix to Salary Loan only (`loanCode` starting with `SL-`) rather than
system-wide, since Seafarer/Business loans weren't confirmed to show the same reliable pattern.

**Implemented** in `BorrowerRiskSummaryService.summarize()` (commit `9db46218`): for Salary Loan
accounts, an installment counts as on-time if paid before the next installment's own due date
(falling back to the original same-due-date check for a loan's last installment, which has no
"next" to compare against). Verified before shipping:
- Nomer Perez's on-time rate: 0% → 89.5% (17 of 19 settled installments) under the new rule.
- A before/after comparison script confirmed byte-identical results for a Seafarer-loan-only
  borrower (Brigido Magsanay, 9 loans) - no regression for non-Salary-Loan products.

## Current state

- Fix live: `easycashbackend` rebuilt and redeployed, healthy.
- Follow-up task withdrawn (resolved this session, not left pending).
- Not yet extended to Seafarer Loan (`SML-`) even though the earlier bucket analysis showed a
  similar (smaller) 10-19-day cluster there too - deliberately left alone since the same-day
  verification (LEAD() check against real data) was only run against a Salary Loan borrower.
  Worth the same verification exercise for a Seafarer borrower before extending the rule if this
  comes up again.

## Follow-up questions answered same day

- **"Paano kung new loan at wala pang loan account dito?"** (what about a brand-new applicant with
  no loan account yet) - traced both relevant code paths and confirmed both degrade gracefully to
  Payment History showing N/A, never a crash or a wrong number: (1) no `application.borrowerId` at
  all - the risk-summary query is `enabled: Boolean(application.borrowerId)`, so it never even
  fires; (2) `borrowerId` set but zero loan accounts or zero settled installments -
  `BorrowerRiskSummaryService.summarize()`'s `settledCount > 0 ? ... : null` guard returns
  `onTimePaymentRate: null` cleanly. Either way the Internal Credit Score rescales over the
  remaining applicable factors (Income/DTI/Employment), same as documented in
  `docs/INTERNAL_CREDIT_SCORE.md`'s own "Rescaling" section.
- **"Naka-apply na ba ito sa lahat ng application na papasok sa LMS?"** (is the fix already live for
  everything, not just this one case) - yes: `BorrowerRiskSummaryService` is the one shared service
  behind `/borrowers/:id/risk-summary`, consumed by three frontend surfaces
  (`LoanApplicationDetailPage.tsx`'s Internal Credit Score, `ClientProfilePage.tsx`'s own risk
  summary card, `LoanApplicationsPage.tsx`'s risk tiles). Nothing is cached/stored - it's computed
  live on every page load - so every Salary Loan applicant/client already benefits from the fix
  with no further action, both existing applications already in the system and any new one
  submitted from here on.
