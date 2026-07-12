# Calculation Engine Specification

**Status:** Living document — the single source of truth for every financial calculation in this
platform. Update whenever a formula is verified, changed, or an `UNRESOLVED` section is resolved,
per `CLAUDE.md`'s Decision Log requirement.
**Produced:** Milestone 9 (documentation phase), 2026-07-03.
**Evidence base:** `docs/Legacy Analysis/2026-07-03-milestone9-financial-rules-verification.md`
(all sections); `docs/Architecture/ADR-007-outstanding-balance-formula.md`,
`ADR-009-payment-allocation-order.md`, `ADR-010-addon-vs-contractual-interest.md`,
`ADR-032-loan-release-vs-disbursement.md`, `ADR-047-financial-audit-isolation.md`,
`ADR-048-optimistic-concurrency.md`; `docs/Architecture/FINANCIAL_INVARIANTS.md`. As of 2026-07-11,
also cross-validated against a second, independently-built system: MIS Nomer's own hand-built
Excel-based LMS, `legacy/reports/BETA 1.5.83 LMSv3.xlsm` (§1, §2) — see those sections for what
was and wasn't traced (the workbook's ~32MB `vbaProject.bin` macro code was not decompiled; only
its worked-example output was verified against this spec's formulas).
**Rule:** every formula below is either cited to verified legacy evidence, a legal loan document,
or explicitly marked `STATUS: UNRESOLVED`. No formula in this document was filled in from general
lending-industry convention. Where a formula is `UNRESOLVED`, implementation must not proceed for
that calculation until it is resolved — this is a hard gate, not a suggestion, per
`FINANCIAL_INVARIANTS.md §9`.

---

## How to read this document

Each calculation section follows the same structure: Purpose, Inputs, Outputs, Configuration
Required, Formula, Rounding, Precision, Examples, Edge Cases, Validation Rules, Test Vectors,
Dependencies, Referenced ADRs. Every quantity in every formula is a `Money` or `Percentage` value
object (`app/backend/src/shared/domain/Money.ts`, `Percentage.ts`) — never a native `number` — per
`FINANCIAL_INVARIANTS.md §5`.

---

## 1. Declining-Balance Interest Per Period

### Purpose
Computes the interest portion of a single installment period for any declining-balance loan
(both `InterestCalculationMethod.DECLINING_BALANCE` and `DECLINING_BALANCE_DISCOUNTED` — see §3
for why these two are calculation-identical).

### Inputs
- `outstandingPrincipalBalance: Money` — the principal balance immediately before this period
  (i.e., after the previous period's principal payment was applied, or the disbursed principal
  for period 1).
- `monthlyContractualRate: Percentage` — the loan's stored, snapshot-at-approval interest rate
  (`LoanAccount.interestRate`).

### Outputs
- `interestForPeriod: Money`

### Configuration Required
- None beyond the two inputs — this calculation does not consult `roundingMethod` or any other
  `LoanProductVersion` field directly (rounding is applied by the caller per §7, not by this
  calculation itself).

### Formula
```
Interest_n = OutstandingPrincipalBalance_(n-1) × MonthlyContractualRate
```

**Evidence:** `legacy/reports/201 Loan Docs Generator/Sample Computation Sheet updated.xlsx`,
sheet `computation sheet`, cell `E42`: `IF(G42<0,(H41*$C$27),0)`. Validated exactly against real
transaction data twice, on two different products: loan `SL-REG_U1V1J`
(`17782.61 × 0.0495 = 880.24`, matching the real `interest_due` to the centavo, and again on a
second installment: `15164.97 × 0.0495 = 750.67`) and loan `SL-LAZ_V5N0R`
(`2000 × 0.2499 = 499.8`, matching the real `INTEREST_APPLIED` transaction exactly). See
`docs/Architecture/ADR-010-addon-vs-contractual-interest.md` §1–§2.

**Second, independent source (2026-07-11):** MIS Nomer's own hand-built Excel-based LMS,
`legacy/reports/BETA 1.5.83 LMSv3.xlsm` (a separate, personally-maintained tool — not SDevTech/
Mambu legacy production data, but a second from-scratch implementation of the same lending
business's rules). Its `TempAmort` sheet's 5-period worked example (₱102,912.36 principal, 5-month
term) has no live formula for `Interest`/`Principal`/`Balance` (pasted computed values — the sheet's
`vbaProject.bin`, ~32MB, is presumed to hold the actual macro logic and was not decompiled), but
reverse-derivation from the pasted values confirms `Interest_n ÷ Balance_(n-1)` is constant at
`4.85000%` across all 5 periods (`4.85000%` to `4.85001%`, floating-point noise only) — the exact
same `Interest_n = Balance_(n-1) × Rate` relationship as this formula, and matching the workbook's
own `Rate_details` lookup table (`TERM=5 → CONTRACTUAL=4.85`).

**STATUS: CONFIRMED** (now by two independently-built systems, not just one legacy source).

### Rounding
Not specified by the formula itself. `Money.multiply()` (already implemented) rounds to
`Decimal(14,2)` using half-up rounding for a single multiplication — this is the correct method
to call for this formula, since it is exactly one multiplication (Balance × Rate), matching
`Money.multiply()`'s documented scope (`shared/domain/Money.ts`: "Rounds to the money scale using
half-up rounding — a fixed, documented arithmetic default for a single multiplication").

### Precision
`Decimal(14,2)` for `Money`, `Decimal(6,3)` for `Percentage`, per `FINANCIAL_INVARIANTS.md §5`.

### Examples
| `outstandingPrincipalBalance` | `monthlyContractualRate` | `interestForPeriod` | Source |
|---|---|---|---|
| 17,782.61 | 4.95% | 880.24 | `SL-REG_U1V1J`, installment 1 |
| 15,164.97 | 4.95% | 750.67 | `SL-REG_U1V1J`, installment 2 |
| 2,000.00 | 24.99% | 499.80 | `SL-LAZ_V5N0R`, installment 1 |
| 102,912.36 | 4.85% | 4,991.25 | `BETA 1.5.83 LMSv3.xlsm` `TempAmort`, installment 1 |
| 84,231.92 | 4.85% | 4,085.25 | `BETA 1.5.83 LMSv3.xlsm` `TempAmort`, installment 2 |
| 64,645.48 | 4.85% | 3,135.31 | `BETA 1.5.83 LMSv3.xlsm` `TempAmort`, installment 3 |
| 44,109.10 | 4.85% | 2,139.29 | `BETA 1.5.83 LMSv3.xlsm` `TempAmort`, installment 4 |
| 22,576.70 | 4.85% | 1,094.97 | `BETA 1.5.83 LMSv3.xlsm` `TempAmort`, installment 5 |

### Edge Cases
- **Zero balance** (fully paid): `Interest_n = 0 × rate = 0`. Not separately verified against
  legacy data (no case with a zero starting balance was sampled) but follows deterministically
  from `Money.multiply()`'s existing, already-tested behavior.
- **Final period rounding remainder**: not addressed by this formula alone — see §7.

### Validation Rules
- `outstandingPrincipalBalance` must be `>= 0` at the point this calculation is invoked (a
  negative starting balance would represent an already-overpaid loan, which is a valid *loan*
  state per `FINANCIAL_INVARIANTS.md §3` but this specific formula's applicability to that state
  is `STATUS: UNRESOLVED` — not tested against any legacy example).
- `monthlyContractualRate` must be a value already validated by `Percentage.of()`'s existing
  construction rules.

### Test Vectors
See Examples table above — every row is directly reusable as a unit test fixture, each citing its
source loan/workbook.

### Dependencies
None (this is a leaf calculation).

### Referenced ADRs
`docs/Architecture/ADR-010-addon-vs-contractual-interest.md`.

---

## 2. Level Payment Amortization (`PMT`)

### Purpose
Computes the fixed periodic payment amount for a declining-balance loan, and the resulting
per-period principal/interest/balance schedule.

### Inputs
- `principal: Money`
- `monthlyContractualRate: Percentage`
- `numberOfInstallments: number` (positive integer)

### Outputs
- `monthlyPayment: Money`
- `schedule: Array<{ period: number; interestPortion: Money; principalPortion: Money;
  remainingBalance: Money }>`

### Configuration Required
- `LoanProductVersion.repaymentPeriodUnit` (currently only `MONTHS` per schema enum) — this
  formula assumes a monthly period; a different period unit would require a different rate
  convention, `STATUS: UNRESOLVED` (no legacy evidence examined a non-monthly period).

### Formula
```
MonthlyPayment = (MonthlyContractualRate × Principal) / (1 − (1 + MonthlyContractualRate)^(−NumberOfInstallments))
```
Per period `n` (using §1's `Interest_n` formula):
```
Interest_n = Balance_(n-1) × MonthlyContractualRate
Principal_n = MonthlyPayment − Interest_n
Balance_n = Balance_(n-1) − Principal_n
```

**Evidence:** `Sample Computation Sheet updated.xlsx`, cell `C29`: `PMT(C$27,C28,-C26)*-1`, and
the amortization table `A39:H59`. Validated: the full 8-installment worked example in the
workbook reproduces its own stated `MonthlyPayment = 11,875.38` and terminates with
`remainingBalance ≈ 0` (`9.09e-12`, a floating-point artifact of the workbook's own
double-precision Excel calculation, not evidence against the formula) after 8 periods. See
`docs/Architecture/ADR-010-addon-vs-contractual-interest.md` §1, evidence item 2 (the
independent from-scratch `PMT` reimplementation, tested against 9 real released loans, matching
each to within a few centavos).

**Second, independent source (2026-07-11):** MIS Nomer's own hand-built Excel-based LMS,
`legacy/reports/BETA 1.5.83 LMSv3.xlsm`, sheet `TempAmort` (see §1's evidence entry above for
this source's nature/caveats). Recomputing `MonthlyPayment = (Rate × Principal) / (1 − (1 +
Rate)^−n)` with `Principal = 102,912.36`, `Rate = 4.85%`, `n = 5` gives `23,671.69` — an **exact
match**, to the centavo, against the workbook's own pasted `Amortization` value for installments
1–4. Installment 5 shows `23,671.67` (2 centavos less) with `Balance` landing on exactly `0` —
consistent with this project's own `ROUND_REMAINDER_INTO_LAST_REPAYMENT` behavior (§7), not a
contradiction of it, though this workbook's own internal logic for *why* it does this was not
traced (VBA not decompiled — see §1).

**STATUS: CONFIRMED** (now by two independently-built systems, not just one legacy source).

### Rounding
`MonthlyPayment` should be rounded to `Decimal(14,2)` once, at computation time — not
re-derived per period (the workbook computes it once in `C29` and reuses the same value `C$29`
for every period's cash flow, confirmed by the formula's absolute cell reference). Each period's
`Interest_n` uses §1's rounding. `Principal_n` is a subtraction (`MonthlyPayment − Interest_n`),
which is exact given both operands are already `Decimal(14,2)`.

### Precision
`Decimal(14,2)` throughout.

### Examples
| `principal` | `monthlyContractualRate` | `numberOfInstallments` | `monthlyPayment` | Source |
|---|---|---|---|---|
| 80,953.71 | 3.7% | 8 | 11,875.38 | `Sample Computation Sheet` worked example |
| 102,912.36 | 4.85% | 5 | 23,671.69 | `BETA 1.5.83 LMSv3.xlsm` `TempAmort` worked example |

(Two full worked examples with every period's values are now available, from two independently
built sources. Additional test vectors should still be constructed once §4's `UNRESOLVED` flat-rate
question and real disbursed-loan schedules are available for cross-checking against
`repayments.bson` schedule rows for other products.)

### Edge Cases
- **`numberOfInstallments = 1`**: `MonthlyPayment` reduces to `Principal × (1 + MonthlyContractualRate)`
  — not separately verified, but follows algebraically from the formula; the one 1-month legacy
  example checked (`SML-QC_00026`, Add-On and Contractual both 10%) is consistent with this but
  wasn't traced through the full per-period schedule mechanics, only the aggregate total-interest
  figure (§3).
- **Rounding-remainder on the final installment**: see §7 — `LoanProductVersion.roundingMethod`
  (`ROUND_REMAINDER_INTO_LAST_REPAYMENT`) governs whether a naive per-period calculation's
  residual cent(s) are absorbed into the last installment; this workbook's formula does not
  itself implement that — it is a caller-level concern, `STATUS: UNRESOLVED` for the exact
  mechanics (see §7).

### Validation Rules
- `numberOfInstallments` must be a positive integer (matches `LoanAccount.installmentCount`'s
  existing type).
- `monthlyContractualRate` must be `> 0` for this formula (a `0%` rate divides by zero in the
  denominator's `1 − (1+0)^-n = 0` — not observed in any legacy example, and requires a
  degenerate-case formula, `STATUS: UNRESOLVED`, not addressed by any evidence examined).

### Test Vectors
See Examples table. Additional vectors needed — see Examples note above.

### Dependencies
§1 (Declining-Balance Interest Per Period).

### Referenced ADRs
`docs/Architecture/ADR-010-addon-vs-contractual-interest.md`.

---

## 3. Add-On ↔ Contractual Rate Conversion

### Purpose
Converts between a quoted Add-On interest rate and the Contractual (note) rate actually used to
run §1/§2's declining-balance schedule, for loan origination/quotation and disclosure purposes.

### Inputs
- `principal: Money`
- `contractualMonthlyRate: Percentage` (for the forward direction: Contractual → Add-On)
- `numberOfInstallments: number`

### Outputs
- `totalInterest: Money`
- `addOnMonthlyRate: Percentage`

### Configuration Required
None beyond the inputs.

### Formula
```
MonthlyPayment = PMT(contractualMonthlyRate, numberOfInstallments, -principal)   [§2]
TotalInterest = (MonthlyPayment × NumberOfInstallments) − Principal
AddOnMonthlyRate = (TotalInterest / Principal) / NumberOfInstallments
```

**Evidence:** `Sample Computation Sheet updated.xlsx`, cell `A61` and `Get Gross (2)!D23`. Cross-
validated three independent ways against real loan data — see
`docs/Architecture/ADR-010-addon-vs-contractual-interest.md` §2 for the full evidence chain,
including a bit-exact match against the company's own `parameter` lookup table on 8 of 9 real
loans in `Monthly-Loan-ReleaseS.xlsx`.

**STATUS: CONFIRMED** — this is the highest-confidence formula in this entire specification.

### Rounding
`AddOnMonthlyRate` is rounded to 2 decimal places for display purposes in the workbook
(`ROUND(...,2)`), consistent with `Percentage`'s `Decimal(6,3)` schema precision allowing more
precision than is typically displayed — the underlying stored value should retain full
`Decimal(6,3)` precision; only presentation-layer display should round to 2 places, per this
project's established pattern (`Presenter` classes are "the sole place `Money`/`Percentage`...get
serialized," `docs/PROJECT_HANDOFF.md §8`).

### Precision
`Decimal(14,2)` for `Money`, `Decimal(6,3)` for `Percentage`.

### Examples
See `docs/Architecture/ADR-010-addon-vs-contractual-interest.md` §2's 9-row validation table
(all sourced from `Monthly-Loan-ReleaseS.xlsx`) — reproduced here as the canonical test vectors:

| `principal` | `numberOfInstallments` | `contractualMonthlyRate` | `totalInterest` (reported) | `addOnMonthlyRate` (reported) |
|---|---|---|---|---|
| 35,956.32 | 6 | 5.73% | 7,545.24 | 3.5% |
| 215,432.98 | 6 | 4.55% | 35,578.26 | 2.75% |
| 36,091.11 | 4 | 4.7% | 4,338.03 | 3% |
| 135,760.67 | 5 | 5.63% | 23,766.18 | 3.5% |
| 58,630.34 | 2 | 3.98% | 3,523.00 | 3% |
| 169,261.96 | 12 | 4.69% | 55,913.44 | 2.75% |
| 850,318.95 | 12 | 3.47% | 203,749.93 | 2% |
| 518,870.10 | 4 | 4.31% | 57,087.24 | 2.75% |

### Edge Cases
- **1-month loans**: Add-On and Contractual rates are trivially equal (`SML-QC_00026`: both
  10%) — confirmed by this formula degenerating correctly at `n=1` (§2's edge case applies here
  too).
- **The reverse direction (Add-On → Contractual)** is not a closed-form inversion of the formula
  above — the legacy system uses a **precomputed lookup table** (`parameter` sheet, six tiers ×
  12 terms) rather than solving the formula algebraically in reverse. `STATUS: PARTIALLY
  CONFIRMED` — the new system should implement this as a genuine numerical solve (e.g. bisection
  or Newton's method against §3's forward formula) rather than a hard-coded six-tier table,
  specifically so it isn't limited to the tiers this one legacy sample happened to cover (see
  `docs/Architecture/ADR-010-addon-vs-contractual-interest.md` §6).

### Validation Rules
Same as §2 (this formula depends on §2's `PMT` calculation).

### Test Vectors
See Examples table — all 8 non-degenerate rows are exact, real, citable test vectors.

### Dependencies
§2 (Level Payment Amortization).

### Referenced ADRs
`docs/Architecture/ADR-010-addon-vs-contractual-interest.md`.

---

## 4. Flat-Rate Interest Calculation

### Purpose
Would compute interest for a loan using `InterestCalculationMethod.FLAT`.

### STATUS: UNRESOLVED

No formula for this method was found or verified anywhere in the evidence gathered across all
four Milestone 9 investigation passes. The `Sample Computation Sheet updated.xlsx` workbook is
built entirely around declining-balance calculations (§1–§3) — no flat-rate worked example or
formula cell was found in it. One real legacy loan using `FLAT` (`loan_accounts` id `2051`,
`interestCalculationMethod: "FLAT"`) was observed to have a self-consistent total (`principalPaid
+ principalBalance = loanAmount`, and `interestPaid` present) but its interest was never
decomposed period-by-period against a verified formula the way §1's declining-balance examples
were.

**Do not implement this calculation from general lending-industry convention** (e.g. the common
`TotalInterest = Principal × AnnualRate × Years` flat-rate formula) — per `PROJECT_RULES.md`'s
explicit prohibition on using an industry-standard formula "simply because it is common," and
per this document's own rule that nothing here may be filled in without evidence.

**Evidence required to resolve:** either (a) a worked example in a legacy spreadsheet/document
not yet examined, (b) a set of real `FLAT`-method loans' `repayments.bson` schedule rows traced
against candidate formulas the way §1 traced `SL-REG_U1V1J`, or (c) direct confirmation from
someone with institutional knowledge of how `FLAT` products were priced.

### Dependencies
None yet determined.

### Referenced ADRs
None yet — this calculation blocks any future `FLAT`-product ADR or amendment to ADR-010.

---

## 5. Payment Allocation Order

### Purpose
Determines, for a single payment applied against a loan, which component (fees, penalty,
interest, principal) receives funds first, and how much.

### Inputs
- `paymentAmount: Money`
- `feesDue: Money`
- `penaltyDue: Money`
- `interestDue: Money`
- `principalDue: Money`
(all for the relevant installment(s) in scope — see Edge Cases for cross-installment handling)

### Outputs
- `{ feesApplied: Money; penaltyApplied: Money; interestApplied: Money; principalApplied: Money;
  remainder: Money }`

### Configuration Required
None currently — this ADR-009-sourced order is treated as platform-wide (see Edge Cases on
`LoanProductVersion.repaymentAllocationOrder`'s open configurability question).

### Formula
```
remaining = paymentAmount
feesApplied     = min(remaining, feesDue);     remaining -= feesApplied
penaltyApplied  = min(remaining, penaltyDue);  remaining -= penaltyApplied
interestApplied = min(remaining, interestDue); remaining -= interestApplied
principalApplied = min(remaining, principalDue); remaining -= principalApplied
remainder = remaining   // unapplied excess, if any — see §11 (Overpayment Handling)
```

**Evidence:** `201 Loan Docs PN Template.docx` (Promissory Note), clause 4 — legally binding
contractual text: *"Any payments made by me/us shall be applied first to collection charges and
other fees, then penalties, interest, and principal in that order."* Penalty-before-both and
interest-before-principal are additionally confirmed transactionally (see
`docs/Architecture/ADR-009-payment-allocation-order.md` §2 for the full evidence and per-tier
confidence breakdown — fees-first is contractually confirmed but transactionally unverified).

**STATUS: CONFIRMED (contractual text — see ADR-009 for per-tier transactional confidence).**

### Rounding
Each `min()` operation compares and assigns exact `Decimal(14,2)` values already at money
precision — no independent rounding step is introduced by this formula itself.

### Precision
`Decimal(14,2)`.

### Examples
| `paymentAmount` | `feesDue` | `penaltyDue` | `interestDue` | `principalDue` | Result | Source |
|---|---|---|---|---|---|---|
| 1,748.94 | 0 | 0 | 880.24 | 2,617.64 | interest=880.24, principal=868.70 | `SL-REG_U1V1J`, installment 1, first payment |
| 6,518.95 | 0 | ≥6,518.95 | (nonzero) | (nonzero) | penalty=6,518.95, interest=0, principal=0 | `SML-MAX_K5W8S`, 2020-05-18 |

### Edge Cases
- **Cross-installment allocation** (a payment exceeding the current installment's total due):
  `STATUS: PARTIALLY CONFIRMED` — every sampled legacy loan applied payments to installments in
  due-date order, but no sampled case tested an out-of-order or simultaneous multi-installment
  payment. This formula, as written, operates on a single installment's due amounts; a
  `PaymentAllocationService` (per `docs/Architecture/ADR-042-aggregate-boundaries.md` §7) must
  wrap this formula in a loop across installments in due-date order, per the observed (not
  formula-proven) pattern.
- **Remainder after all tiers satisfied**: see §11, `STATUS: UNRESOLVED`.
- **Manual/directed payments** (the legacy `FEE_REPAYMENT`/`PENALTY_REPAYMENT` transaction types
  — see `docs/Architecture/ADR-009-payment-allocation-order.md` §4): this formula describes the
  *default, algorithmic* allocation; whether the new system needs a manual-override channel that
  bypasses this order entirely is `STATUS: UNRESOLVED`.
- **`LoanProductVersion.repaymentAllocationOrder: Json?`**: whether this order should be
  configurable per product (as the schema field's type suggests) or fixed platform-wide (as the
  evidence — one uniform Promissory Note template — suggests) is `STATUS: UNRESOLVED`, per
  `docs/Architecture/ADR-009-payment-allocation-order.md` §7.

### Validation Rules
- `paymentAmount` must be `> 0` for a normal payment (a `0` or negative payment is not a
  "payment" in this formula's domain — reversals/adjustments are separate calculations, see §10).
- All `*Due` inputs must be `>= 0`.

### Test Vectors
See Examples table.

### Dependencies
None (this is a leaf calculation, called by the cross-installment `PaymentAllocationService`).

### Referenced ADRs
`docs/Architecture/ADR-009-payment-allocation-order.md`.

---

## 6. Outstanding Balance / Running Ledger Total

### Purpose
Maintains the authoritative running balance for a `LoanAccount`, updated atomically with every
`LoanTransaction`.

### Inputs
- `previousBalance: Money`
- `transactionEffect: Money` (the signed net effect of the new transaction on the balance being
  tracked)

### Outputs
- `newBalance: Money`

### Configuration Required
**UNRESOLVED — see `docs/Architecture/ADR-007-outstanding-balance-formula.md` §3**: whether
"balance" means a single, all-inclusive figure (including penalty) or requires two distinct
tracked totals (a penalty-inclusive collections balance and a penalty-exclusive accounting
balance) is an open decision this calculation cannot proceed past without.

### Formula
```
NewBalance = PreviousBalance + TransactionEffect
```

**Evidence:** exact replay match, multiple independent cases — see
`docs/Architecture/ADR-007-outstanding-balance-formula.md` §1 for the full evidence chain. The
**mechanism** (a maintained running total, updated per transaction, never re-derived by summing
historical component fields) is `STATUS: CONFIRMED`. The **scope** (what "balance" includes) is
`STATUS: UNRESOLVED`.

### Rounding
No independent rounding — both operands are already `Decimal(14,2)`; addition is exact.

### Precision
`Decimal(14,2)`.

### Examples
See `docs/Architecture/ADR-007-outstanding-balance-formula.md` §1's cited examples (`SL-LAZ_V5N0R`,
`SL-LAZ_A6J8E`, `SL-REG_00099`).

### Edge Cases
- **Overpayment / negative balance**: valid state, not an error, per
  `FINANCIAL_INVARIANTS.md §3` — `Money` itself never encodes "negative is illegal."
- **Zero-amount transactions that still move the balance** (`FEES_DUE_REDUCED`,
  `*_ADJUSTMENT` types observed in legacy data): `STATUS: UNRESOLVED` — the legacy system appears
  to treat some transaction types as authoritative snapshot corrections rather than incremental
  deltas (`docs/Legacy Analysis/...` §3.1.1, §7.5). The new system's design must decide whether
  every `LoanTransaction` is a pure delta (simpler, but may not represent every legacy scenario)
  or whether some transaction types are snapshot-style — this is an open design question, not
  resolved by this specification.

### Validation Rules
Every write to this value must occur within the same database transaction as the triggering
`LoanTransaction` insert (`FINANCIAL_INVARIANTS.md §3`) — no "manual balance adjustment" write
path may exist outside a typed `LoanTransaction`.

### Test Vectors
See Examples above.

### Dependencies
§5 (Payment Allocation Order) and §9 (Capitalization) both produce `transactionEffect` values
that feed this calculation.

### Referenced ADRs
`docs/Architecture/ADR-007-outstanding-balance-formula.md`.

---

## 7. Rounding and Remainder Allocation

### Purpose
Governs how sub-centavo or final-installment rounding differences are resolved, per-product.

### Inputs
- `LoanProductVersion.roundingMethod`: `NO_ROUNDING | ROUND_REMAINDER_INTO_LAST_REPAYMENT`
  (existing schema enum).
- The set of `Money` amounts to be split/rounded (e.g. a schedule's per-period interest values,
  or a payment being allocated across installments).

### Outputs
Depends on context — either an unmodified set of amounts (`NO_ROUNDING`) or a set where the
final installment absorbs the cumulative rounding residual.

### Configuration Required
`LoanProductVersion.roundingMethod`, per product, per `FINANCIAL_INVARIANTS.md §5`, `FIN-4`.

### Formula
**For splitting a single amount across multiple recipients exactly** (e.g. allocating a payment
across components, or splitting a total among installments): use the already-implemented,
already-tested `Money.allocate(parts)` method (`shared/domain/Money.ts`) — a largest-remainder
algorithm that guarantees the parts sum exactly back to the original amount, correctly handling
negative amounts (the Milestone 7.1 C-1 fix). This is `STATUS: CONFIRMED` — already implemented
and unit-tested, not new to this milestone.

**For `ROUND_REMAINDER_INTO_LAST_REPAYMENT` specifically** (a per-schedule-generation-time
concern, not a per-payment concern): `STATUS: RESOLVED (business decision, 2026-07-06)`. No
legacy amortization schedule was traced installment-by-installment against a candidate "does the
last installment absorb the cumulative rounding residual" rule with enough precision to confirm
the exact mechanics from evidence alone (the `Sample Computation Sheet` worked example (§2)
terminates at a balance of `9.09e-12`, which is a floating-point display artifact of Excel's own
arithmetic, not evidence of a deliberate remainder-allocation rule being exercised) — so, absent
evidence, this was resolved as an explicit business decision rather than left unimplemented:
**only `principalPortion` absorbs the residual on the final installment; `interestPortion` is
never adjusted.** Rationale: interest is a contractual rate applied to a balance and must not be
inflated/deflated to force a reconciliation; principal is "whatever balance remains," which can
legitimately absorb a few centavos. Mechanically: the final installment's `principalPortion` is
overridden to the exact remaining beginning balance (guaranteeing `endingPrincipal` lands on
precisely `0.00`), and that installment's `payment` is recomputed as
`interestPortion + principalPortion` — which may therefore differ by a few centavos from every
other installment's `payment` (all still equal to the regular, formula-computed `monthlyPayment`).
Implemented in `shared/domain/calculation/AmortizationScheduleGenerator.ts`.

### Rounding
See above — `Money.allocate()` for exact-sum splitting; the schedule-generation-time rule now
resolves the final installment's principal/`endingPrincipal` to exactly zero, per the decision
above.

### Precision
`Decimal(14,2)`.

### Examples
`Money.allocate()`'s existing test suite (`tests/unit/shared/Money.test.ts`) already covers
positive, negative, zero, single-recipient, uneven-remainder, very-small, and large-magnitude
cases — reusable as-is for any calculation in this document that needs exact splitting.

### Edge Cases
See `Money.allocate()`'s docstring for its own documented edge-case handling (already
implemented, Milestone 7.1).

### Validation Rules
Any code that rounds a monetary value without consulting `LoanProductVersion.roundingMethod` is
a defect, per `FINANCIAL_INVARIANTS.md §5`, `FIN-4` — this applies to every calculation in this
document that produces a schedule (§2) or splits an amount (§5).

### Test Vectors
See `tests/unit/shared/Money.test.ts` (existing).

### Dependencies
Used by §2, §5, and any future schedule-generation calculation.

### Referenced ADRs
None new — governed by the existing `FINANCIAL_INVARIANTS.md §5` invariant.

---

## 8. Day-Count / Partial-Period Interest (30/360 Convention)

### Purpose
Computes interest for a partial (broken) period — e.g. the time between disbursement and the
first scheduled installment, if it doesn't align to a full period.

### Inputs
- `principal: Money`
- `monthlyContractualRate: Percentage`
- `daysElapsed: number` (calendar days between two dates)

### Outputs
- `partialPeriodInterest: Money`

### Configuration Required
`LoanProductVersion.daysInYearConvention` — currently always `"E30_360"` in every legacy record
examined (a plain string field per the schema's own comment: "Only one convention evidenced in
legacy data... kept as a plain string rather than a single-value enum pending confirmation that
no other convention is ever used").

### Formula
```
DailyRate = MonthlyContractualRate / 30
PartialPeriodInterest = ROUND(Principal × DailyRate × DaysElapsed, 0)
```

**Evidence:** `Sample Computation Sheet updated.xlsx`, cells `C9`/`K8`/`K9`:
`ROUND(Principal_Amount*(Interest/30)*DATEDIF(Date_Released,Date_released2,"d"),0)`. This
independently re-derives, from a live formula, the `E30_360` convention already noted (but not
previously independently verified) in the schema's own comments. See
`docs/Legacy Analysis/2026-07-03-milestone9-financial-rules-verification.md` §8.8.

**STATUS: CONFIRMED.**

### Rounding
The workbook's own formula rounds to **0 decimal places** (whole pesos) for this specific
"Advance Interest" calculation — note this differs from the `Decimal(14,2)` precision used
elsewhere in this document. `STATUS: PARTIALLY CONFIRMED` — this specific rounding-to-whole-pesos
behavior is observed in the one formula cited, but whether it should carry over to the new
system's general partial-period interest handling (as opposed to being specific to this one
"Advance Interest" upfront-deduction context) is not independently confirmed.

### Precision
`Decimal(14,2)` generally; the cited formula's own rounding narrows this to whole pesos for this
specific use — see Rounding above.

### Examples
No specific real-loan numeric example was traced end-to-end for this formula (the cell was
observed and its formula text extracted, but the specific worked-example values in the sheet
were for a scenario where this particular line evaluated to a value already shown in
`docs/Architecture/ADR-010-addon-vs-contractual-interest.md`'s evidence, not independently
re-verified against a real MongoDB loan's partial-period interest transaction).

### Edge Cases
Not examined — `daysElapsed = 0` (no partial period) presumably yields `0` interest, but this
wasn't tested.

### Validation Rules
`daysElapsed` must be a non-negative integer.

### Test Vectors
None available yet beyond the formula's own citation — construct from a real partial-period
legacy loan once one is identified and traced.

### Dependencies
None.

### Referenced ADRs
None directly — supports amortization schedule generation (§2) for loans with a non-aligned first
period.

---

## 9. Capitalization of Unpaid Interest/Penalty at Maturity

### Purpose
At loan maturity, folds any unpaid penalty and interest into principal, which then itself accrues
interest.

### Inputs
- `unpaidPenalty: Money`
- `unpaidInterest: Money`
- `currentPrincipalBalance: Money`

### Outputs
- `newPrincipalBalance: Money = currentPrincipalBalance + unpaidPenalty + unpaidInterest`

### Configuration Required
None specified by the evidence.

### Formula
```
NewPrincipalBalance = CurrentPrincipalBalance + UnpaidPenalty + UnpaidInterest
```
Thereafter, §1's formula applies to the new, larger principal balance.

**Evidence:** `201 Loan Docs PN Template.docx` (Promissory Note), clause 4: *"Upon maturity, all
unpaid penalties and unpaid interests shall automatically become part of the principal and shall
bear interest at the same rate stipulated above."*

**STATUS: CONFIRMED (contractual text); UNVERIFIED (transactional mechanism)** — this is a
plausible, evidence-consistent explanation for observed unbounded balance growth in some arrears
loans, but no discrete legacy transaction type was found that unambiguously represents this as an
executed, discrete step (see `docs/Architecture/ADR-009-payment-allocation-order.md` §3).

### Rounding
Addition of already-rounded `Decimal(14,2)` values — exact, no independent rounding needed.

### Precision
`Decimal(14,2)`.

### Examples
No isolated transaction demonstrating this exact mechanism was found — the balance-growth
*pattern* consistent with it was observed in `SML-MAX_K5W8S` and `SL-CORP_A7G0T` (both cited in
`docs/Architecture/ADR-009-payment-allocation-order.md` §3), but not decomposed into a specific
"this transaction was the capitalization event" citation.

### Edge Cases
**When exactly is "maturity" reached, for a loan that's already in arrears past its original
maturity date?** `STATUS: UNRESOLVED` — not addressed by any evidence gathered. Does
capitalization happen once, at the original scheduled maturity date, or repeatedly (e.g. at every
subsequent "maturity" if the loan is restructured/extended)? No evidence answers this.

### Validation Rules
None determined.

### Test Vectors
None available — construct once the transactional mechanism (Edge Cases, above) is clarified.

### Dependencies
§1 (subsequent interest calculations use the new, capitalized principal).

### Referenced ADRs
`docs/Architecture/ADR-009-payment-allocation-order.md`.

---

## 10. Reversals and Adjustments

### Purpose
Would define how a posted transaction is corrected without violating the ledger's append-only
invariant (`TXN-1`).

### STATUS: PARTIALLY CONFIRMED / UNRESOLVED

**Confirmed:** the append-only principle itself (`TXN-1`, already enforced at the type level —
`ILoanTransactionRepository` exposes no `update()`/`delete()` method, per
`FINANCIAL_INVARIANTS.md §1` and already-built Milestone 7 code). Corrections must be new,
explicitly linked transactions, never edits.

**Unresolved:** legacy evidence shows **two different, non-uniform reversal conventions**
coexisting (`docs/Architecture/ADR-009-payment-allocation-order.md` §4):
- An explicit bidirectional link (`reversal_transaction_key`/`reversesTransaction`), used by
  `DISBURSMENT` and `WRITE_OFF` corrections — this matches the new schema's existing
  `reversesTransactionId` design.
- An unlinked, same-shaped, oppositely-signed correction (`REPAYMENT_UNDO`, 213 occurrences),
  with no back-reference to what it corrects.

Additionally, at least 11 distinct legacy `*_ADJUSTMENT` transaction-type variants exist, versus
the new schema's single `LoanTransactionType.ADJUSTMENT` value — whether this granularity needs
preserving is undetermined.

**No formula is specified here because none was found or is needed for the linked-reversal case**
(the new schema's existing `reversesTransactionId` design already correctly models it). The open
question is a **data-modeling** one (does the new system need an unlinked-correction transaction
type, and does it need adjustment-type granularity), not a calculation-formula one — it does not
block §1–§9's calculations, but does need resolution before `RecordLoanTransactionUseCase`'s real
callers are built with full fidelity to observed legacy behavior.

### Dependencies
None.

### Referenced ADRs
`docs/Architecture/ADR-009-payment-allocation-order.md`.

---

## 11. Overpayment Handling

### Purpose
Would define what happens to a payment amount exceeding everything currently due (after §5's
allocation exhausts every tier).

### STATUS: UNRESOLVED — no legacy evidence found

Two targeted full-collection searches (524,463 legacy transactions) found **zero examples** of an
overpayment being recorded: no nonzero `redraw_balance`/`advance_deposition` field values, and no
negative `balance` value, anywhere in the dataset (`docs/Legacy Analysis/...` §7.7).
`PROJECT_RULES.md §Payments` requires the system to support overpayments as a valid state, and
`FINANCIAL_INVARIANTS.md §3` already establishes that `Money` must never encode "negative is
illegal" — but this document cannot specify a *formula* for overpayment handling (does the excess
advance to the next installment automatically? does it require an explicit "advance payment"
transaction type? is it simply left as a negative balance?) because no legacy transaction
demonstrates any of these mechanisms in practice.

**Evidence required to resolve:** a real legacy overpayment transaction (not found in this
export), or direct confirmation from someone with institutional knowledge of how the legacy
system was intended to handle this case even if it was rarely/never exercised in practice.

### Dependencies
§5 (Payment Allocation Order) — this calculation would consume §5's `remainder` output.

### Referenced ADRs
`docs/Architecture/ADR-009-payment-allocation-order.md` §4.

---

## 12. Penalty Calculation

### Purpose
Computes the penalty amount owed on an overdue installment, for loans originated going forward
through this system (see Scope below — this explicitly does NOT apply to already-migrated loans).

### Inputs
- `overdueAmount: Money` — the unpaid Principal + Interest for the installment (not principal alone).
- `dueDate: Date`
- `asOfDate: Date` (defaults to "now" — the date penalty is being computed as of).
- `ratePercent: Percentage` — resolved from the loan's own `principalAmount` (5 or 10, see Formula
  and Configuration Required — NOT read from a per-`LoanProductVersion` `PenaltyRule` row; see
  `ADR-050` §4 for why).
- `gracePeriodDays: number` — 3, fixed, same for every loan (see Configuration Required).

### Outputs
- `penaltyOwed: Money`

### Configuration Required
**A global rule, applied identically to every loan/product** (`ADR-050` §4, 2026-07-11 revision —
originally proposed as per-`LoanProductVersion` `PenaltyRule` configuration, rejected because a
single product version's loan-amount range can straddle the ₱10,000 threshold): `gracePeriodDays =
3`; `ratePercent = 5%` when that specific loan's `principalAmount` ≤ ₱10,000, `10%` otherwise (all
Easycash loans are unsecured — see `ADR-050` §1). Compounding and whole-months-only counting are
likewise fixed behavior of the formula itself, not configurable at all. `PenaltyRule`'s schema
fields remain unused by this feature — available for a future genuinely-per-product policy if one
is ever confirmed, not built now (YAGNI).

### Formula
```
graceEndDate = dueDate + gracePeriodDays
if asOfDate <= graceEndDate:
    penaltyOwed = 0
else:
    // Whole months are counted from the ORIGINAL due date, not from graceEndDate — the grace
    // period is purely a yes/no gate on whether any penalty applies at all, not a shift in the
    // month-counting anchor. Verified against ADR-050 §1's worked example: due 2026-07-01, paid
    // 2026-10-01 → wholeCalendarMonthsBetween(2026-07-01, 2026-10-01) = exactly 3, matching the
    // 3-month compounding table there. (Anchoring at graceEndDate instead would have given only 2
    // whole months for that same example — graceEndDate is 2026-07-04, and Oct 1 is 3 days short
    // of completing a 3rd month from that later start point.)
    monthsLate = floor(wholeCalendarMonthsBetween(dueDate, asOfDate))  — partial months don't count
    penaltyOwed = overdueAmount × ((1 + ratePercent/100)^monthsLate − 1)
```

**Evidence:** `ADR-050` — confirmed directly by the user (MIS), 2026-07-11, as a new, going-forward
policy (explicitly not a claim about historical legacy behavior — see that ADR's §3 for the real,
contradictory legacy `PENALTY_APPLIED` evidence this formula deliberately does not try to match).
The 5%/10% tiering by ≤₱10,000 principal exists because of BSP Circular No. 1133 (2021)/SEC
Memorandum Circular No. 3 (2022)'s penalty ceiling for small unsecured loans — see `ADR-050` §2 for
why the tier ignores that circular's own 4-month-tenor condition.

**STATUS: CONFIRMED** (formula, rate, grace period, compounding, tiering) — via direct business/MIS
testimony, same evidentiary standing as other testimony-confirmed rules in this system (e.g.
`ADR-046`'s Add-On-Rate basis). `capPercent` enforcement (the 100%-of-principal total cost cap)
remains **UNRESOLVED**, still gated by `ADR-008` (not produced this milestone).

### Rounding
Not yet specified to the same decimal-place rigor as §1–§9 — `ADR-050` gives the formula in terms
of exact compounding; whether intermediate monthly steps round to `Decimal(14,2)` before the next
compounding step (as the worked example in `ADR-050` §1 does) or the whole-period formula is
applied once without intermediate rounding is not yet distinguished (they can differ by a few
centavos over several months). Use the step-by-step monthly rounding shown in `ADR-050`'s worked
example — that is what was actually confirmed with the user.

### Precision
`Decimal(14,2)`, rounded at each monthly compounding step (see Rounding above).

### Examples
See `ADR-050` §1's worked example: ₱10,000.00 overdue, 10% rate, 3 whole months late →
₱1,000.00 + ₱1,100.00 + ₱1,210.00 = ₱3,310.00 total penalty.

### Edge Cases
- Paid within the grace period (`asOfDate <= dueDate + gracePeriodDays`): zero penalty.
- Fewer than one whole month past the grace period: zero penalty (no proration) — the first
  compounding step only fires once a full month has elapsed past `graceEndDate`.

### Validation Rules
`overdueAmount` must be non-negative; `gracePeriodDays`/`ratePercent` come from an already-valid
`PenaltyRule` snapshot, not re-validated here.

### Test Vectors
See Examples above — directly reusable as a test fixture.

### Scope — prospective only (ADR-050 §5)
**Applies only to loans originated going forward through this system.** Already-migrated loans'
stored `penaltyDue`/`penaltyPaid`/`penaltyBalance` are never recomputed by this formula and remain
exactly as migrated (CP12) — including loans still ACTIVE and overdue today. Transitioning an
already-active migrated loan onto live penalty accrual, if ever wanted, is an explicitly deferred,
separate decision per `ADR-050` §5.

### Dependencies
§6 (Outstanding Balance) — penalty accrual feeds the running balance once applied/allocated.

### Referenced ADRs
`ADR-050` (primary source — formula, rate, tiering, prospective-only scope).

---

## 13. Insurance Fee (Loan Origination)

### Purpose
Computes the one-time Insurance Fee deducted at loan disbursement (Create Loan Account —
`OriginationFees.insuranceFee`), distinct from any recurring per-installment fee.

### Inputs
- `monthlyAmortization: Money` — the loan's level payment amount (§2's `MonthlyPayment`).
- `numberOfInstallments: number` (Term).

### Outputs
- `insuranceFee: Money`

### Configuration Required
None — unlike every other origination fee in this system, this one is not staff-entered by
default; it is computed, though still staff-editable/zeroable afterward (no separate "waive"
mechanism is implemented — see Edge Cases).

### Formula
```
TotalContract = MonthlyAmortization × NumberOfInstallments
InsuranceFee  = (TotalContract ÷ 1000) × NumberOfInstallments
IF TotalContract < 50,000: InsuranceFee += 20
InsuranceFee = CEILING(InsuranceFee, 1)   — round UP to the nearest whole peso
```

**Evidence:** transcribed verbatim (2026-07-11) from the `CalculateInsurance()` VBA macro in MIS
Nomer's own hand-built Excel LMS, `legacy/reports/BETA 1.5.83 LMSv3.xlsm` (source provided
directly by the user, not reverse-engineered from spreadsheet cells — no formula or dedicated
table for this fee exists anywhere in the workbook's ~18 sheets, confirmed by an exhaustive
text search across all of them for "insurance"; the computation lives entirely in VBA). Validated
exactly against 4 real loans from `Loans_details`:

| Loan | Monthly Amortization | Term | Computed | Actual (`Insurance Fee` column) |
|---|---|---|---|---|
| `SML-REG_00365` | 16,220.83 | 4 | 260 | 260 |
| `SML-REG_00364` | 18,336.88 | 6 | 661 | 661 |
| `SL-REG_00109` | 8,746.84 | 6 | 315 | 315 |
| `SML-REG_00350` | 24,881.10 | 2 | 120 | 120 |

**STATUS: CONFIRMED** — sourced from the real macro code itself (not inferred), then independently
verified against 4 real disbursed loans, all exact.

### Rounding
`CEILING(x, 1)` — rounds UP to the nearest whole peso (never half-up, never down) — this is the
macro's own explicit final step, not this project's usual `Decimal(14,2)` half-up convention;
applied only to this fee.

### Precision
Intermediate `TotalContract`/pre-ceiling `InsuranceFee` values are not rounded — only the final
result is, via `CEILING`.

### Examples
See the Evidence table above — directly reusable as test fixtures.

### Edge Cases
- **Product/loan-level waiver**: the source macro has a `chkWaiveInsurance` checkbox that zeroes
  this fee out entirely when checked, per-loan (not a product-level default — real data shows
  `SL-CORP` loans with both zero and nonzero Insurance Fee values, ruling out a per-product waiver
  rule). Not implemented as a separate control here; staff can already edit/zero any origination
  fee field directly in the Create Loan Account form, which covers the same outcome.
- **`TotalContract` exactly 50,000**: the macro's condition is `< 50000` (strict), so exactly
  50,000 does NOT get the +20 — not separately evidenced, but follows directly from the
  transcribed condition.

### Validation Rules
- `monthlyAmortization` and `numberOfInstallments` must both be positive — not separately
  evidenced (the macro guards on `IsNumeric`/waiver-checkbox state, not on these being positive),
  but a non-positive input here would come from an already-invalid §2 result.

### Test Vectors
See Examples table above.

### Dependencies
§2 (Level Payment Amortization) — this fee is computed from that formula's `MonthlyPayment`
output, not from principal directly.

### Referenced ADRs
None — sourced directly from the VBA macro source, not a legacy-data ADR investigation.

### Open discrepancy (not yet resolved)
A second, newer live-production Excel calculator, `legacy/reports/Net Amount Auto Computation v3
with Account Management Fee.xlsx` (`AutoV2` sheet, e.g. cell `D16`:
`ROUNDUP((Amortization×Term)/1000×Term, 0)`), computes the same core formula **without** the
`+20 if TotalContract < 50,000` term present in the `CalculateInsurance()` macro above. Not yet
investigated further or confirmed either way (no real loan with `TotalContract < 50,000` has been
traced through both sources) — flagged here so it isn't lost, not acted on.

---

## 14. Advance Interest Fee (Loan Origination)

### Purpose
Computes the one-time Advance Interest Fee deducted at loan disbursement (Create Loan Account —
`OriginationFees.advanceInterestFee`) when the gap between disbursement and the first scheduled
repayment exceeds 30 days.

### Inputs
- `grossLoanAmount: Money` (Principal)
- `addOnRatePercent: Percentage` — the `LoanProductVersion`/quote's Add-On Rate, **not**
  Contractual Rate (§3, `ADR-010`).
- `disbursementDate: Date`
- `firstRepaymentDate: Date`

### Outputs
- `advanceInterestFee: Money`

### Configuration Required
Per-`LoanProductVersion` eligibility (`chargesAdvanceInterestFee`-style flag) — **UNRESOLVED**, see
`ADR-046` §4/§7. Currently implemented as a per-loan auto-computed suggestion (always populated
when the >30-day condition holds), freely editable/zeroable by staff, rather than a per-product
hard rule — a deliberate scope choice pending that business decision.

### Formula
```
gapDays = firstRepaymentDate − disbursementDate   (calendar days)
IF gapDays > 30:
    excessDays = gapDays − 30
    advanceInterestFee = CEILING(grossLoanAmount × (addOnRatePercent / 100) × (excessDays / 30), 1)
ELSE:
    advanceInterestFee = 0
```

**Evidence:** `ADR-046` (population-wide statistical fit: 62.6% exact match, 74.6% within 5% across
449 real loans, 2021 encoding-anomaly cohort excluded) plus, as of 2026-07-11, independent
corroboration against a live, currently-active account (`SML-REG_00373`) matched exactly across
three separate sources — see `ADR-046` §3.5:

| Source | Advance Interest Fee |
|---|---|
| This formula, hand-computed | ₱1,508.00 |
| Official Disclosure Statement (R.A. 3765) for this account | ₱1,508.00 |
| Legacy SDevTech production system's stored value | ₱1,508.00 |

(Inputs: Gross ₱115,926.97, Add-On Rate 3.00%/month, disbursed 2026-07-03, 1st due 2026-08-15 —
43-day gap, 13 excess days.) The same live-account cross-check also independently reconfirmed the
Account Management Fee (exactly 1% of Gross) and the §13 Insurance Fee macro formula, both exact.

A second, newer live-production Excel calculator (`Net Amount Auto Computation v3 with Account
Management Fee.xlsx`, `AutoV2` sheet, cell `D20` and 20+ structurally-identical per-quote copies)
was independently read and found algebraically identical to this formula, confirming the Add-On
Rate rate-basis and ceiling-to-whole-peso rounding a second, independent way. That sheet also
revealed a manual per-quote `"With Advance Interest?"` YES/NO toggle gating the fee even when the
>30-day condition holds — a plausible real mechanism behind the per-product/per-loan eligibility
gap `ADR-046` already flags as unresolved, but not itself a confirmed configuration rule.

**STATUS: CONFIRMED** — formula, rate basis, and rounding convention. Per-product eligibility
remains **UNRESOLVED** (business decision required, see `ADR-046` §7).

### Rounding
`CEILING(x, 1)` — round UP to the nearest whole peso, same convention as §13 Insurance Fee; departs
from this document's usual `Decimal(14,2)` precision, intentionally, for this fee only.

### Precision
Intermediate values are not rounded — only the final result, via `CEILING`.

### Examples
See the Evidence table above — directly reusable as a test fixture.

### Edge Cases
- `gapDays ≤ 30`: fee is `0`, no partial credit.
- No per-product eligibility gate is currently enforced (see Configuration Required) — the fee is
  suggested for every loan meeting the >30-day condition, regardless of product.

### Validation Rules
`grossLoanAmount` and `addOnRatePercent` must both be positive; dates must be valid calendar dates
with `firstRepaymentDate ≥ disbursementDate`.

### Test Vectors
See Examples table above.

### Dependencies
None beyond its own inputs — computed independently of §1–§13.

### Referenced ADRs
`ADR-046` (primary source), `ADR-010` (Add-On vs. Contractual rate distinction), `ADR-045`
(`firstRepaymentDate` as an explicit input).

---

## Summary — What Can Be Implemented Now vs. What Remains Blocked

| Calculation | Status | Implementable in Milestone 9.1? |
|---|---|---|
| §1 Declining-Balance Interest Per Period | CONFIRMED | Yes |
| §2 Level Payment Amortization (`PMT`) | CONFIRMED | Yes |
| §3 Add-On ↔ Contractual Conversion | CONFIRMED (forward); PARTIALLY CONFIRMED (reverse solve method) | Yes, with reverse-direction implemented as a numerical solve, not a hard-coded table |
| §4 Flat-Rate Interest | UNRESOLVED | **No** — blocked, needs evidence |
| §5 Payment Allocation Order | CONFIRMED (contractual) | Yes, with cross-installment looping and remainder handling flagged as open sub-designs |
| §6 Outstanding Balance / Running Total | CONFIRMED (mechanism); UNRESOLVED (scope) | Partially — the running-total mechanism can be built; which balance concept(s) it tracks needs ADR-007 §3 decided first |
| §7 Rounding / Remainder Allocation | CONFIRMED (`Money.allocate()`, exists); RESOLVED, business decision 2026-07-06 (`ROUND_REMAINDER_INTO_LAST_REPAYMENT`: principal-only absorbs the residual) | Yes — implemented in `AmortizationScheduleGenerator.ts` |
| §8 Day-Count / Partial-Period Interest | CONFIRMED | Yes |
| §9 Capitalization at Maturity | CONFIRMED (contractual); UNRESOLVED (timing mechanics) | Partially — the arithmetic is simple, but "when" is undetermined |
| §10 Reversals and Adjustments | PARTIALLY CONFIRMED / UNRESOLVED (data modeling, not a formula) | N/A — design question |
| §11 Overpayment Handling | UNRESOLVED | **No** — blocked, needs evidence |
| §12 Penalty Calculation | CONFIRMED (formula/rate/grace/compounding/tiering, via `ADR-050`, direct business testimony); UNRESOLVED (`capPercent`/`ADR-008`) | Yes, for new loans going forward only — prospective scope per `ADR-050` §5; migrated loans' stored penalty figures are untouched |
| §13 Insurance Fee (Loan Origination) | CONFIRMED (sourced from real VBA macro, verified against 4 real loans) | Yes — implemented in `LoanAccountCreatePage.tsx`'s `computeInsuranceFee()` |
| §14 Advance Interest Fee (Loan Origination) | CONFIRMED (formula/rate-basis/rounding; per-product eligibility UNRESOLVED, see `ADR-046` §7) — exact match against a live 2026 account across 3 independent sources | Yes — implemented in `LoanAccountCreatePage.tsx`'s `computeAdvanceInterestFee()`, as a per-loan suggestion pending the eligibility decision |

**Correctness over completeness, as instructed**: this document ends with four genuinely
unresolved calculations (§4, §9's timing, §10's data model, §11) rather than inventing formulas for
them. §1, §2, §3, §5 (contractually), §6 (mechanism), §7 (resolved, business decision), §8, §12
(new loans only), §13, and §14 are ready to guide real implementation.
