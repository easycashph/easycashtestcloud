# ADR-010 — Add-On vs. Contractual Interest Rate

**Status:** Accepted, with named open sub-questions (Milestone 9 design review, 2026-07-03)
**Context documents:** `docs/Legacy Analysis/2026-07-03-milestone9-financial-rules-verification.md`
§3.3, §8.3–§8.7, §8.12, §9 (evidence); `docs/Architecture/FINANCIAL_INVARIANTS.md` §8 (prior
open-item listing); `prisma/schema.prisma` (`LoanAccount.interestRate`, `.addOnInterestRate`,
`.contractualInterestRate`).
**Evidence sources:** `legacy/reports/201 Loan Docs Generator/Sample Computation Sheet
updated.xlsx` (live Excel formulas — the primary evidence for this ADR); `legacy/reports/
Monthly-Loan-ReleaseS.xlsx`; `legacy/mongodb/.../loan_accounts.bson`, `loan_products.bson`;
`legacy/reports/201 Loan Docs Generator/201 Loan Docs DS Template.docx` (Disclosure Statement)
and `PN Template.docx` (Promissory Note).

---

## 1. Decision

**Contractual Rate is the primary, independently-specified interest rate. Add-On Rate is a
derived, disclosure-oriented figure computed from the results of a standard declining-balance
amortization schedule run at the Contractual Rate — never an independent input to that
schedule.**

Concretely:

1. **The interest calculation formula for every declining-balance product** (both
   `DECLINING_BALANCE` and `DECLINING_BALANCE_DISCOUNTED` — see §5) is:

   ```
   Interest_n = OutstandingPrincipalBalance_(n-1) × MonthlyContractualRate
   ```

   applied period-by-period, where `MonthlyContractualRate` is the loan's stored, snapshot-at-
   approval rate (`LoanAccount.interestRate`, already modeled by the existing schema).

2. **The periodic payment amount is computed via the standard financial `PMT` (annuity) formula**:

   ```
   MonthlyPayment = PMT(MonthlyContractualRate, NumberOfInstallments, -Principal)
                   = (MonthlyContractualRate × Principal) / (1 − (1 + MonthlyContractualRate)^(−NumberOfInstallments))
   ```

3. **Add-On Rate, when it needs to be shown for disclosure/comparison purposes, is derived — never
   collected or stored as an independent scheduling input:**

   ```
   TotalInterest = Σ(Interest_n for n = 1..NumberOfInstallments)
                 = (MonthlyPayment × NumberOfInstallments) − Principal
   AddOnMonthlyRate = (TotalInterest / Principal) / NumberOfInstallments
   ```

4. **The company maintains (maintained, historically) a fixed lookup table** mapping
   `(Add-On Rate tier, Term in months) → Contractual Rate`, for at least six Add-On tiers (1.5%,
   2%, 2.5%, 2.75%, 3%, 3.5% monthly) across terms 1–12 months. This table's values are the exact
   numerical output of formula (3) above, applied in reverse (see §2, evidence item 3) — it is not
   an independent or conflicting source of truth, it is a precomputed cache of the same
   relationship for loan officers to consult without running the formula by hand.

---

## 2. Evidence

**Formula (1)/(2) — CONFIRMED, exact match against real transaction data.** Located at
`Sample Computation Sheet updated.xlsx`, sheet `computation sheet`, cells `C27` (Contractual Rate
input), `C29` (`PMT(C$27,C28,-C26)*-1`), and the amortization table `A39:H59` (per-row
`Interest_n = Balance_(n-1) × Contractual_Rate`, cell `E42` etc.). Verified against real loan
`SL-REG_U1V1J` (`loan_accounts.uid: 8a8e8e3d8a866fae018a87f45dc63dee`, `interestRate: 4.95`):
- Installment 1: `17782.61 × 0.0495 = 880.24`, matching the real `repayments` schedule row's
  `interest_due: 880.24` to the centavo.
- Installment 2: `15164.97 × 0.0495 = 750.67` (rounds from `750.66535`), matching the real
  schedule row's `interest_due: 750.67` exactly.
- A second, independent loan on a different (plain `DECLINING_BALANCE`, rate 24.99%) product
  (`SL-LAZ_V5N0R`) reproduces the same formula: `2000 × 0.2499 = 499.8`, matching its real
  `INTEREST_APPLIED` transaction exactly.

**Formula (3) — CONFIRMED, the strongest-evidenced finding in the entire Milestone 9
investigation, cross-validated three independent ways:**
1. `Sample Computation Sheet updated.xlsx`, cell `A61`: a text formula stating
   `="Interest Rate of " & (Contractual_Rate*100) &"% is equivalent to the Add On Rate of " &
   ROUND(((Total_InterestRate/C26)/Monthly_Inst)*100,2) & "% per Month"`, where
   `Total_InterestRate` (`C37`) is `SUM($E$40:$E$59)` — the sum of every period's interest from
   the formula-(1) schedule.
2. An independent from-scratch reimplementation of formula (3) (implemented without first reading
   the company's own lookup table), tested against all 9 real released loans in
   `Monthly-Loan-ReleaseS.xlsx`, reproduced the reported Add-On Rate to within 0.005 percentage
   points and the reported Total Interest peso amount to within a few centavos, on every row
   (e.g. `SL-REG_00116`: Loan Amount 35,956.32, Term 6, Contractual 5.73% → predicted Total
   Interest 7,545.22 vs. reported 7,545.24; predicted Add-On 3.497% vs. reported 3.5%).
3. `Sample Computation Sheet updated.xlsx`, hidden sheet `Get Gross (2)`, cell `D23`, labeled
   `"Total OB ="`: `=D20*C4*get_gross_term+D20`, i.e.
   `TotalObligation = GrossLoanAmount × (1 + AddOnRate × Term)` — algebraically the same
   relationship, independently present in a completely different sheet built for a different
   purpose (reverse net-to-gross underwriting, not post-release reporting).

**The company's lookup table itself (`parameter` sheet, hidden) was checked against all 9 real
loans in `Monthly-Loan-ReleaseS.xlsx` and matched exactly (bit-exact, not "within rounding") on
8 of 9 rows** (the 9th is a 1-month loan where Add-On and Contractual are trivially equal
regardless of method) — e.g. Add-On 3.5%/Term 6 → table value 5.73%, matching `SL-REG_00116`'s
reported Contractual Rate of 5.73% exactly.

**The legally-disclosed "Effective Interest Rate" equals Contractual Rate — CONFIRMED,
definitional finding.** `201 Loan Docs DS Template.docx` (the Disclosure Statement, required
under R.A. 3765, Truth In Lending Act) prints its "5. EFFECTIVE INTEREST RATE" section populated
by the merge field `{{ContractualInterestRate}}` — not an IRR-derived figure. This is direct
evidence for how the term "Effective Interest Rate" is used in this company's actual borrower-
facing legal disclosure practice.

---

## 3. What was found but is explicitly NOT part of this decision

**An IRR/Present-Value-based "Effective Annual/Monthly Interest Rate" formula exists in the
workbook** (`computation sheet!C34`: `(1+IRR($G$41:$G$59))^Monthly_Inst-1`; `C35`:
`IRR($G$41:$G$59)`, computed against the loan's actual net cash flow stream — net proceeds after
upfront fee deductions, followed by the contractual payment stream). This is a real,
methodologically sound formula. **It is explicitly excluded from this ADR's decision** because
the Disclosure Statement evidence above shows the company's actual "Effective Interest Rate"
disclosure uses Contractual Rate, not this IRR-derived figure, and no MongoDB collection or
Excel report examined stores an IRR-derived value anywhere to corroborate that it's operationally
used at all. **STATUS: UNRESOLVED** — if a future need arises for a true IRR/APR-style effective
rate (e.g. for a different disclosure requirement, or richer reporting), this formula is
available and formula-verified, but this ADR does not mandate building it, since no evidence
shows it's part of the current, executed business process.

---

## 4. Confidence summary

| Element | Confidence |
|---|---|
| Contractual Rate is the primary rate; interest computed as `Balance × MonthlyRate` per period | **CONFIRMED** — exact match, 3 installments across 2 independent loans/products |
| `PMT`-based level-payment formula | **CONFIRMED** — formula found, matches computed schedule exactly |
| Add-On Rate is derived (`TotalInterest / Principal / Term`), not an independent scheduling input | **CONFIRMED** — 3 independent cross-validating sources, matched to real data |
| Add-On→Contractual lookup table | **CONFIRMED** — bit-exact match, 8 of 9 real loans |
| "Effective Interest Rate" (as legally disclosed) = Contractual Rate | **CONFIRMED** (definitional) |
| IRR/PV-based EIR/MIR formula as an operationally-used figure | **UNVERIFIED** — formula exists, no evidence of actual use |

---

## 5. Open sub-question NOT resolved by this ADR: the `DECLINING_BALANCE_DISCOUNTED` naming question

A full-population investigation (all 835 `DECLINING_BALANCE_DISCOUNTED` loan accounts in the
legacy database, not a sample) found:

- **0 of 835 (0%)** exhibit the "interest deducted upfront at disbursement" behavior that the
  Sample Computation Sheet's "Interest deduct upfront" toggle would predict for a loan labeled
  `DISCOUNTED`.
- **809 of 835 (96.9%)** exhibit ordinary periodic interest, mechanically identical
  (`Balance × MonthlyRate`, confirmed exact) to plain `DECLINING_BALANCE` loans.
- **62.8%** of `DECLINING_BALANCE_DISCOUNTED` loans' stored rates exactly match the Add-On→
  Contractual conversion table above, versus **0%** of plain `DECLINING_BALANCE` loans (all of
  which use a single flat rate, 24.99%, never produced by that table).
- Product-level configuration (`loan_products.bson`) confirms the `DISCOUNTED` label consistently
  at the product level for the largest contributing products — ruling out isolated data-entry
  error.

**Conclusion (PARTIALLY CONFIRMED, not fully CONFIRMED): `DISCOUNTED` most plausibly describes
how the loan's Contractual Rate was originally *priced* (derived by discounting an Add-On quote
via the conversion table above), not how interest is *timed* during servicing.** This is a
**naming inconsistency between two distinct, independently legitimate business concepts that
happen to share the word "discount"** — not a bug, not a data-entry error, not a migration
artifact, and not incorrect product configuration (all explicitly checked and ruled out).

**Decision for the calculation engine: `DECLINING_BALANCE` and `DECLINING_BALANCE_DISCOUNTED`
use the identical interest-calculation algorithm (formula (1)/(2) above).** No runtime behavioral
difference between the two `InterestCalculationMethod` enum values has been found in any of the
835 + 309 loans checked. This part of the decision is made — it does not need a business decision
to proceed with calculation-engine implementation.

**What remains open (explicitly NOT decided by this ADR):** whether the distinction between the
two enum values needs to be preserved going forward as a *loan-servicing* concept at all, given
it has no calculation-time effect, or whether it should be reclassified as a
*rate-origination/quotation-time* concept (e.g., "this rate was derived via Add-On conversion," a
metadata flag separate from the interest-calculation method actually executed). **STATUS:
UNRESOLVED — requires a business decision**, not further data mining. A working recommendation,
not a decision: if origination-time Add-On quoting remains a real business need (§8.4/§8.12/§9.5
of the Legacy Analysis document already flag it as one, independent of this naming question), it
is reasonable to keep `DECLINING_BALANCE_DISCOUNTED` as the enum name for continuity with 835
existing legacy loans' data, while documenting in code (not silently) that it is calculation-
identical to `DECLINING_BALANCE`.

---

## 6. What this decision does NOT resolve

- **37.2% of `DECLINING_BALANCE_DISCOUNTED` loans' rates do not match the six-tier lookup table**
  examined (rates like 10%, 20%, 24%, 24.99%, 25% appear in the population) — whether these
  represent other, uncaptured tiers of the same conversion table, a different product era, or a
  genuinely different pricing methodology is **UNRESOLVED**.
- **26 of 835 `DECLINING_BALANCE_DISCOUNTED` loans (3.1%)** show neither periodic interest nor
  upfront deduction in their transaction history (all disbursed 2010–2019) — **UNRESOLVED**,
  plausibly pre-full-ledger-capture accounts, too small a minority to affect §5's conclusion.
- **Whether every future loan product will fall within the six Add-On tiers this specific lookup
  table covers**, or whether new products will need the underlying `PMT`-based formula computed
  directly rather than a table lookup, is not addressed — the new system should implement formula
  (3) as a real calculation (§1), not merely reproduce the six-tier table as a hard-coded lookup,
  precisely so it isn't limited to the tiers this one legacy sample happened to cover.

---

## 7. Implementation notes

- `Money`/`Percentage` value objects (already built, `shared/domain/Money.ts`,
  `shared/domain/Percentage.ts`) are the correct types for every quantity in formulas (1)–(3) —
  no native `number` arithmetic, per `FINANCIAL_INVARIANTS.md §5`.
- The `PMT` formula requires care with `Percentage`/`Money` semantics: it is not a simple multiply/
  allocate operation like the value objects' existing methods — the calculation-engine work
  (Milestone 9.1+) will need a new, dedicated calculation service, not an addition to `Money`
  itself (consistent with `FINANCIAL_INVARIANTS.md §7`'s guidance that cross-cutting calculation
  logic belongs in a stateless domain service, not inside a value object or aggregate).
- Rounding: `FINANCIAL_INVARIANTS.md §5`'s `FIN-4` rule (rounding is configured per product via
  `LoanProductVersion.roundingMethod`) applies to formula (1)'s per-period interest and formula
  (2)'s payment amount — see `docs/Architecture/CALCULATION_ENGINE_SPEC.md` for the precise
  rounding treatment per calculation.
- This ADR does not by itself unblock `ActivateLoanUseCase` — ADR-007 (balance formula) remains a
  separate, still-open prerequisite.
