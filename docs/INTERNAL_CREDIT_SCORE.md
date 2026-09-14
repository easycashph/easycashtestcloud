# Internal Credit Score — Reference

**Status:** Live (LMS Loan Application Detail page, Underwriting card)
**Source of truth:** `computeInternalScore()` in `app/lmsfrontend/src/pages/LoanApplicationDetailPage.tsx`
**Nature:** Advisory only. Does not gate or replace the officer's Approve/Decline decision, and does
not affect the system's own PREAPPROVED/PREDECLINED/INCOMPLETE classification
(`LoanApplicationPreQualificationService` / `LoanApplicationRiskAssessmentService` on the backend).

---

## What it is

A single 0–100 figure, shown as a gauge on the Loan Application Detail page, blending four
underwriting signals into one quick read: **Income**, **Debt-to-Income (DTI)**, **Employment**, and
**Payment History**. It sits alongside — not instead of — the system's own per-check "Decision
scoring" breakdown (age / income-vs-loan / employment) that drives PREAPPROVED/PREDECLINED.

It is computed **client-side, live, on every page load** — never persisted to the database. It
always reflects the application's current data at the moment the Detail page is viewed.

Each factor row is click-to-expand in the UI (added 2026-09-12): shows the exact arithmetic behind
its points, and for the three discrete-band factors (Income, DTI, Employment — Payment History's
points are a continuous `round(rate × 25)`, no band table applies) a small reference table of every
point band, not just the one that applied, so staff can see how close an applicant was to the next
band without doing the math by hand.

---

## The four factors

Each factor is worth a maximum of **25 points**. A factor can also be **Not Applicable (N/A)** when
there isn't enough data to score it meaningfully — see [Rescaling](#rescaling-when-a-factor-is-na)
below for what happens then.

### 1. Income (max 25 pts)

```
incomeRatio = Declared Monthly Income ÷ Estimated Monthly Amortization
```

`Estimated Monthly Amortization` is the same flat-rate estimate the system's own pre-qualification
check uses for the newly requested loan (`loanCategoryFlatRates.ts` —
`(Principal × (1 + MonthlyFlatRate × Term)) ÷ Term`, currently 3.0%/month for every category).

| Income Ratio | Points |
|---|---|
| < 1 | 0 |
| 1.0 – 1.5 | 10 |
| 1.5 – 2.0 | 18 |
| 2.0 – 3.0 | 22 |
| ≥ 3.0 | 25 |

Never N/A — always scoreable once `monthlyIncome` is on file (0 points if income is missing or
too low relative to the loan).

### 2. Debt-to-Income / DTI (max 25 pts)

Reads the **persisted** `application.dtiPercent` directly — the same figure the Loan Applications
list's Risk badge and filter show. It is **not** independently re-derived here; both features share
one number so they can never disagree (fixed 2026-09-12 — see
`docs/session-logs/Office Server PC/SESSION_LOG_2026-08-14_..._payment_adjustment.md` §160 for the
inconsistency this replaced).

| DTI % | Points |
|---|---|
| ≤ 30% | 25 |
| 31% – 40% | 12 |
| > 40% | 0 |
| **N/A** | *(see below)* |

`dtiPercent` is `null` — making this factor N/A — whenever:
- The application's status is **INCOMPLETE** (required documents for its category haven't all been
  uploaded yet — see `requiredDocumentCategories.ts` and
  `LoanApplicationRiskAssessmentService`). This is the common case for a brand-new application.
- No `monthlyIncome` was ever recorded (rare — a data-entry gap).

`application.dtiPercent` itself is computed once at submission
(`assessLoanApplicationRisk(monthlyIncome, estimatedMonthlyAmortization)`,
`dtiPercent = estimatedMonthlyAmortization ÷ monthlyIncome × 100`) and re-derived whenever the
application is edited, reverted, or completes its documents — never recomputed on every read the
way Income/Employment are. See `LoanApplicationRiskAssessmentService.ts` for the full formula and
its own documented v1 scope limit (excludes the applicant's other existing debt).

### 3. Employment (max 25 pts)

```
hasOccupation = application.occupation is set
hasEmployer   = application.employer is set
```

| Condition | Points |
|---|---|
| Both occupation and employer on record | 25 |
| Only one of the two on record | 12 |
| Neither on record | 0 |

Never N/A. Deliberately excludes employment *tenure* (years/months employed) — a `LoanApplication`
only ever records occupation/employer, never tenure; tenure is only captured once a Client Profile
exists, after approval (via the Borrower's own `incomeDetail`).

### 4. Payment History (max 25 pts)

```
points = round(onTimePaymentRate × 25)
```

`onTimePaymentRate` comes from `BorrowerRiskSummaryService.summarize()` — the applicant's track
record across prior loans with Easycash. An installment counts as on-time if `lastPaidAt` is at or
before its own `dueDate` — **except for Salary Loan accounts** (`loanCode` starting `SL-`), where an
installment counts as on-time if paid before the *next* installment's own due date instead (the last
installment of a loan, with no "next" to compare against, falls back to the same-due-date check).
This carve-out exists because Salary Loan installments are commonly paid via two semi-monthly
partial payments (a payroll/allotment deduction pattern) — `lastPaidAt` only records the later of
the two, which lands after the single monthly due date even though the borrower's payroll-driven
payments never actually missed a cycle. Fixed 2026-09-13 (verified via a `LEAD()` window-function
check against real payment history: 16 of 16 non-final Salary Loan installments for the borrower
that surfaced this landed before the next installment's due date). Deliberately scoped to Salary
Loan only — Seafarer/Business loans weren't verified to show the same reliable pattern.

Computed live and uncached, so this fix (and any future change to `summarize()`) applies
immediately everywhere `onTimePaymentRate` is read — not just here, but also
`ClientProfilePage.tsx`'s own risk summary card and the Loan Applications list's risk tiles.

**N/A** whenever the application isn't linked to an existing Borrower yet (`application.borrowerId`
unset) — i.e. any brand-new applicant with no loan history to score. Only meaningful for a renewal
application already tied to an existing client.

---

## Rescaling when a factor is N/A

An N/A factor is **excluded from both the numerator and the denominator** — it does not count as
zero, and it does not shrink the achievable maximum. The remaining applicable factors are rescaled
to still fill the full 0–100 range:

```
Total = ( Σ points of applicable factors ÷ Σ max of applicable factors ) × 100
```

**Example** — a brand-new applicant (Payment History N/A) whose application is still INCOMPLETE
(DTI also N/A): only Income and Employment are applicable, so `Total = (Income + Employment) ÷ 50
× 100` — full 25-point weight each, not diluted by the two N/A factors.

## Risk Tier

```
Total ≥ 70  →  Low
Total ≥ 40  →  Medium
Total < 40  →  High
```

---

## This is *not* the same as the Risk badge

The Loan Applications list's **Risk badge/filter** (Low/Medium/High) is a **pure DTI** measure —
`dtiPercent ≤ 30% / 31–40% / > 40%` — nothing else. The Internal Credit Score's own overall tier is
a **blended** measure across all four factors above. They share terminology (Low/Medium/High) and,
as of 2026-09-12, share the same underlying DTI number — but they answer different questions and
**can legitimately disagree** on a given application (e.g. high DTI but strong income and a clean
payment history could still land Low overall on the Internal Credit Score while the Risk badge
shows High). If this dual terminology causes confusion in practice, renaming one of the two is the
recommended fix — not attempted as of this writing since no such report has come in yet.

## Known scope limits (as of 2026-09-12)

- DTI (both here and in the persisted `dtiPercent`) covers only the newly requested loan's own
  estimated amortization — an applicant's other existing debt (with Easycash or elsewhere) is not
  yet included. See `LoanApplicationRiskAssessmentService.ts`'s own doc comment for why (a real
  booked `LoanAccount`'s product doesn't map cleanly onto the application's free-text category).
- This score is never persisted or exposed via the API — it exists only as a computed value inside
  `LoanApplicationDetailPage.tsx`. A future consumer (a report, an API field) would need its own
  implementation or a refactor to share this logic with the backend.
