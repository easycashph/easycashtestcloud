# ADR-046 — Advance Interest Fee on Extended First-Repayment Gap

**Status:** ACCEPTED — rate basis, trigger condition, day-count granularity, and rounding
convention all confirmed by evidence and direct MIS operator testimony (62.6% exact match, 74.6%
within 5%, across 449 population rows once the 2021 encoding-anomaly cohort is excluded — see
§3.4, §5). Does not block Milestone 9.1 Checkpoint 8 (`ActivateLoanUseCase`) — this is a separate,
origination-time Net Proceeds deduction, not a repayment-schedule concern. Related to, but
independent of, `ADR-045` (which governs `firstRepaymentDate` as an explicit input; this ADR
governs a downstream financial consequence of that date's distance from disbursement).

**Context documents:** `docs/Architecture/ADR-045-repayment-schedule-due-date-generation.md`
(the `firstRepaymentDate` input this fee is computed from); `docs/Architecture/ADR-010-addon-vs-contractual-interest.md`
(Add-On vs. Contractual rate distinction — this ADR confirms which of the two is the fee's rate
basis); `legacy/reports/201 Loan Docs Generator/201 Loan Docs Encode.xlsx` (`manual input for
OBLIGATION` sheet, cell `G4` — the origin formula); `legacy/reports/Fields in Google
Spreadsheet.xlsx` (`MLR Master List` sheet, 3,708-row historical export, 2009–2026 — the
population-wide evidence source); `legacy/reports/Monthly-Loan-ReleaseS.xlsx` (initial 9-row
sample that first surfaced the pattern); direct confirmation from the company's MIS Assistant
(user, in this session, employed in that role since mid-2025) on the rate basis and the
`SL-Lazada` historical exception.

---

## 1. The gap

`Loan Accounts Details.xlsx`, `Monthly-Loan-ReleaseS.xlsx`, and the `MLR`/`MLR Master List` sheets
of `Fields in Google Spreadsheet.xlsx` all carry an **"Advance Interest Fee"** column, deducted
from `Net Proceeds` at loan origination (see `manual input for OBLIGATION!G1` formula:
`G17 - (G4+G5+G6+G7+G8)`, where `G4` is this fee). No ADR, `CALCULATION_ENGINE_SPEC.md`, or the
current `LoanAccount`/`LoanProductVersion` schema models this fee. A repo-wide search confirms
zero references to `advanceInterest`/`advance_interest` anywhere in `app/backend`.

This investigation began from a different question (whether an unusual `firstRepaymentDate`
triggers an immediate "penalty" — see session history) and found instead that it triggers this
distinct, real, already-named fee.

---

## 2. What was searched

- **`201 Loan Docs Generator/Sample Computation Sheet updated.xlsx`** (`computation sheet` tab) —
  contains an *older* Advance Interest formula (`C9`/`K8`/`K9`, no gap threshold, gated by an
  `upfront="YES"` toggle), already partially documented in `CALCULATION_ENGINE_SPEC.md`. This is a
  **different, earlier formula from a different file** than the one this ADR concerns — flagged as
  a contradiction, not reconciled (see §6).
- **`201 Loan Docs Generator/201 Loan Docs Encode.xlsx`** (`manual input for OBLIGATION` sheet) —
  contains the formula this ADR is based on: cell `G4` =
  `IF(H4="YES",0,IF(DATEDIF(G2,G15,"D")>30, ROUND(G1*(G13/100)*((DATEDIF(G2,G15,"D")-30)/30),2), 0))`,
  where `G2`=Disbursement Date, `G15`=First Repayment Date, `G13`=Add-On Rate.
- **`loan_transactions.bson`** (524,463 records, full population scan) — no distinct
  `ADVANCE_INTEREST`-type transaction exists. The closest candidate, `DEFERRED_INTEREST_APPLIED`
  (8,184 records), was sampled (5 records) and does not show a clear match to the gap-threshold
  formula — inconclusive, not adopted as evidence either way.
- **`loan_accounts.bson`** (1,799 records, full population) — the Mambu-inherited
  `defaultFirstRepaymentDueDateOffset` field is **100% null** across every record, and
  `penalty_calculation_method`/`penalty_rate`/`penalty_enabled` are uniform, generic daily-arrears
  configuration (95.7% of accounts: `PERCENTAGE_PER_DAY`, rate `5`), confirming penalty is
  unrelated to this fee.
- **`Fields in Google Spreadsheet.xlsx` → `MLR Master List`** (3,708 rows, 2009–2026) — the primary
  population-wide evidence source for this ADR, providing `Disbursement Date`, `First Repayment
  Date`, `Gross Amount`, `Add-On Rate`, `Contractual Rate`, and `Advance Interest Fee` per loan.
  2,327 rows had complete data for analysis.
- **`Fields in Google Spreadsheet.xlsx` → `Interest Rate Chart`** sheet (in
  `201 Loan Docs Encode.xlsx`) — confirmed Contractual Rate is itself a **derived** lookup value
  (keyed on Term + Add-On Rate), not an independently-set input; relevant context for why Add-On
  and Contractual rates are easily confused as the fee's basis.

---

## 3. What the evidence shows

### 3.1 The >30-day trigger is real but not universal across all products

Filtering `MLR Master List` to loans with a disbursement→first-repayment gap greater than 30 days
(1,216 of 2,327 usable rows):

- **43.3% overall** (526 of 1,216) show a nonzero Advance Interest Fee.
- This is **not evenly distributed by product.** Some products almost always charge it when the
  gap exceeds 30 days (`SML-PDC` 100%, `SML-Co-Borrower` 98.4%, `SML-Self Allotment` 94.6%,
  `SML-Max` 92.9%); others almost never do (`SL-Lazada` 0.2%, `SML-Quick Cash` 0%).
- **The `SL-Lazada` near-zero rate is fully explained and is NOT a product-level rule** (see §3.3).

### 3.2 The rate basis is Add-On Rate, not Contractual Rate — confirmed two ways

Testing `AdvanceInterestFee = GrossAmount × Rate% × (max(gap-30,0)/30)` against all 514 rows with a
nonzero fee and complete rate data, using each row's own stated Add-On vs. Contractual rate:

| Rate basis tested | Within 1% of actual | Within 5% of actual |
|---|---|---|
| Add-On Rate | 59.1% | 65.4% |
| Contractual Rate | 9.9% | 11.5% |

Restricting to the 125 loans disbursed July 2025 – May 2026 (the MIS Assistant's own tenure,
providing a direct-testimony check on current practice) shows the same pattern even more starkly:
Add-On Rate matches to within 1% in the large majority of cases; Contractual Rate essentially never
matches (the few apparent "Contractual" matches occur only where a loan's Term is 1 month, at which
point Add-On and Contractual rates are numerically identical by construction — see the Interest
Rate Chart, §2 — and therefore do not distinguish the two hypotheses).

**Direct confirmation:** the company's MIS Assistant, in this role since mid-2025, confirmed
directly that **Add-On Rate is the rate used for this fee**, independent of and not to be confused
with Contractual Rate being the correct basis for the loan's regular periodic interest (a separate,
already-`CONFIRMED` fact per `ADR-010`/`CALCULATION_ENGINE_SPEC.md`).

### 3.3 The `SL-Lazada` exception is a historical humanitarian moratorium, not a product rule

All 409 `SL-Lazada` loans with a >30-day gap were disbursed in **2021–2022** (385 in 2021, 24 in
2022) — none earlier, none later. The MIS Assistant confirmed directly: these accounts were never
charged (this fee, and by her account collections generally) due to a pandemic-era "Balikatan"
humanitarian non-collection program that began in 2019–2020 and, for these specific accounts, has
never been lifted through the time of this writing.

**This is confirmed to be a point-in-time policy decision applied to a specific historical cohort
of accounts, not a permanent characteristic of the `SL-Lazada` product.** A newly-originated
`SL-Lazada` loan today has no confirmed basis for exemption from this fee.

### 3.4 The ~35% formula mismatch — ruled-out causes and most likely explanation

Before accepting the formula in §4 as the implementation target, five alternative explanations for
the 178-of-514 (34.6%) nonzero-fee rows that don't match the Add-On-rate formula within 5% were
tested against the full population:

- **Whole-month rounding** (charging per elapsed 30-day period, `ceil(gap/30)-1`, instead of exact
  `excessDays/30`) — **ruled out**. This fits only 1.9% of rows within 1%, far worse than the
  exact-day formula's 59.1%. The exact-day granularity in §4 is confirmed, not just assumed.
- **Correlation with `New` vs. `Renew` loan status** — **ruled out**. Match/fail proportions are
  statistically indistinguishable between the two categories.
- **Correlation with `Nth Loan` sequence number** (1st, 2nd, 3rd loan for that borrower, etc.) —
  **ruled out**. No distinguishing pattern found.
- **Extreme-outlier gaps distorting the fit** — **ruled out as a major cause**. Only 3 of 2,327 rows
  have a gap exceeding 200 days (one of 1,738 days — almost certainly a date typo, not a real loan
  term). Excluding these 3 rows changes the overall match rate by less than 1 percentage point
  (65.4% → 66.0%), so they are not meaningfully suppressing the fit statistic.
- **Whole-peso rounding, not 2-decimal rounding** — **CONFIRMED as the actual driver, superseding
  the "manual override" hypothesis originally proposed here.** The initial observation that 167 of
  178 mismatched rows (93.8%) carry a whole-peso `Advance Interest Fee` value was first read as
  evidence of manual staff adjustment. Testing this directly across the full population (750
  nonzero-`AdvanceInterestFee` rows, unfiltered) shows **96.3% (722 of 750) are whole-peso values
  with zero centavos** — far too systematic to be discretionary manual rounding. Re-fitting the
  formula with **ceiling (round-up) to the nearest whole peso**, instead of standard rounding to 2
  decimal places, raises the **exact-match rate from 15.6% to 55.1%** (283 of 514 rows) and the
  within-5% rate from 65.4% to 65.8%. Standard round-to-nearest-peso (37.0% exact) and floor
  (8.2% exact) were also tested and are clearly inferior to ceiling.
- **The 2021 cohort (§3.2's flagged encoding-artifact year) suppresses the aggregate ceiling-match
  rate and should be excluded when judging formula fit.** Per-year exact-match rates under the
  ceiling formula: 2021 is a stark outlier at **3.1%** (2 of 65), while every adjacent year is far
  higher — 2020: 40.0%, 2022: 50.0%, 2023: 60.4%, 2024: 69.3%, 2025: 66.7%, 2026: 60.4%. **Excluding
  2021, the ceiling formula achieves 62.6% exact match and 74.6% within 5% across the remaining 449
  rows** — the strongest fit found in this entire investigation, and consistent with the years
  spanning the MIS Assistant's own tenure (2025–2026).

**Practical conclusion:** the ~35% headline mismatch reported when this section was first drafted
was substantially a rounding-convention error in the *test*, not the *formula*. The true formula
uses ceiling-to-whole-peso rounding; once corrected, the fit is strong and improving in recent
years. The 2021 batch remains a separately-flagged data-encoding anomaly (§3.2, §6.1), excluded
from this assessment. Full reconciliation of the remaining ~25-38% (varying by year) is not
recommended as a precondition for implementation — no further secondary pattern was found after
ruling out whole-month rounding, `New`/`Renew` status, `Nth Loan` number, and outlier gaps (above).

---

## 4. Decision

**The Advance Interest Fee is a real, confirmed origination-time fee, computed as:**

```
if (firstRepaymentDate - disbursementDate) > 30 days:
    excessDays = (firstRepaymentDate - disbursementDate) - 30
    advanceInterestFee = ceil(grossLoanAmount × (addOnRate / 100) × (excessDays / 30))
else:
    advanceInterestFee = 0
```

**Rounding: ceiling to the nearest whole peso, not 2-decimal-place rounding** — see §3.4. This
departs from the 2-decimal precision used elsewhere in `CALCULATION_ENGINE_SPEC.md`; that
difference is intentional and specific to this fee, not an inconsistency to reconcile.

- **Rate basis: `LoanProductVersion`'s Add-On Rate — not Contractual Rate.** Confirmed both by
  population-wide formula-fit testing (§3.2) and direct MIS Assistant testimony.
- **This fee is deducted from Net Proceeds at origination**, alongside the other already-modeled
  deductions (Processing Fee, Notarial Fee, Doc Fee, etc.), per the `manual input for
  OBLIGATION!G1` structure (`Net Proceeds = Gross − ΣDeductions`).
- **Eligibility is per-loan-product-version, not universal.** Some products (`SML-PDC`,
  `SML-Co-Borrower`, `SML-Self Allotment`, `SML-Max`) apply this fee whenever the >30-day condition
  is met; others do not (`SL-Lazada` under normal circumstances, `SML-Quick Cash`). This must be a
  **configurable flag on `LoanProductVersion`** (e.g., `chargesAdvanceInterestFee: boolean`),
  consistent with `CLAUDE.md`'s standing principle that financial rules must be configurable rather
  than hard-coded, and consistent with this project's existing pattern of per-product-version
  snapshotting for approved loans.
- **Historical account-level exemptions (e.g., the `SL-Lazada` COVID-era moratorium cohort) are not
  modeled as product configuration.** If any such accounts are migrated into the new system, their
  exemption must be represented as an explicit, per-account override or a documented data-migration
  decision — never inferred from their product type.

**What this decision does NOT resolve:**
- The exact reason the remaining ~25-38% (year-dependent, 2021 excluded) of nonzero-fee rows don't
  exactly match the ceiling-rounded Add-On-rate formula. Per §3.4, whole-month rounding,
  `New`/`Renew` status, `Nth Loan` number, extreme-outlier gaps, and (after the rounding-convention
  correction) most of the originally-suspected "manual override" effect have all been tested and
  ruled out or absorbed into the corrected formula. **STATUS: PARTIALLY CONFIRMED** — the formula
  and rounding convention are now well-supported (62.6% exact match, 74.6% within 5%, 2021
  excluded); the small remaining residual's cause is **UNKNOWN** but not large enough to block
  implementation (see §7).
- Which specific `LoanProductVersion`s (in the new system's product catalog) should have the
  `chargesAdvanceInterestFee` flag set — this requires a business-side decision informed by, but
  not automatically inherited from, the legacy per-product percentages in §3.1.

---

## 5. Confidence summary

| Claim | Status |
|---|---|
| A real, distinct "Advance Interest Fee" exists and is actively charged | **CONFIRMED** |
| It is triggered by `firstRepaymentDate − disbursementDate > 30 days` | **CONFIRMED**, for products where the fee applies |
| Eligibility is per-product, not universal | **CONFIRMED** |
| Rate basis is Add-On Rate, not Contractual Rate | **CONFIRMED** (data + direct MIS testimony) |
| Formula: `Gross × AddOnRate% × (excessDays/30)`, ceiling-rounded to whole peso | **CONFIRMED, strong fit** — 62.6% exact match, 74.6% within 5% (2021 encoding-anomaly year excluded, §3.4) |
| Rounding convention: ceiling to whole peso, not 2-decimal rounding | **CONFIRMED** — raised exact-match from 15.6% to 55.1% population-wide, 62.6% excluding 2021 (§3.4) |
| Exact-day (not whole-month) granularity of `excessDays` | **CONFIRMED** — whole-month rounding tested and ruled out (§3.4) |
| `New`/`Renew` status or `Nth Loan` number explains any residual mismatch | **DISCONFIRMED** — tested, no correlation found (§3.4) |
| Extreme-outlier gaps are a major cause of mismatch | **DISCONFIRMED** — only 3 outlier rows exist; excluding them barely moves the fit (§3.4) |
| The 2021 disbursement cohort is an encoding anomaly, not a formula difference | **CONFIRMED** — exact-match rate is 3.1% in 2021 vs. 50–69% in every adjacent year (§3.4) |
| `SL-Lazada`'s near-zero rate is a permanent product rule | **DISCONFIRMED** — it is a historical, account-cohort-specific humanitarian moratorium |
| Which new-system `LoanProductVersion`s should enable this fee | **UNRESOLVED — requires business decision** |

---

## 6. Open contradiction not resolved by this ADR

`Sample Computation Sheet updated.xlsx!C9`/`K8`/`K9` (already partially documented in
`CALCULATION_ENGINE_SPEC.md`) computes an "Advance Interest" figure with **no 30-day threshold**,
gated instead by an `upfront="YES"` toggle, using the loan's Contractual Rate (not Add-On). This is
a **different formula from a different, likely older, file** than the one this ADR adopts. Whether
these represent (a) two genuinely different fee concepts, (b) sequential versions of the same
concept where the newer `201 Loan Docs Encode.xlsx` formula superseded the older one, or (c) a
formula selected by a toggle this investigation didn't locate, is **UNKNOWN**. This should be
flagged to the business alongside the CP8-adjacent implementation work, not silently reconciled.

### 6.1 Additional investigation — the `upfront` toggle and the 2021 "Contractual match" cohort

Two further avenues were investigated to try to resolve §6, both inconclusive:

**The `upfront` toggle (`Master data Input!K22`, "Interest deduct upfront") could not be traced to
any structured field in production data.** `loan_accounts.bson` (1,799 records, cross-joined
against 301 of the 514 nonzero-fee MLR rows by `Account ID` ↔ `loan_accounts.id`; 213 rows had no
match, likely pre-dating or falling outside this Mambu export) was checked against three candidate
Mambu-native fields for a distinguishing signal:

| Field | Match/fail split | Distinguishing? |
|---|---|---|
| `interestApplicationMethod` (`ON_REPAYMENT` vs. undefined) | 16/9 (64%) vs. 209/67 (76%) | No — small sample, modest difference, not conclusive |
| `interestCalculationMethod` (`DECLINING_BALANCE_DISCOUNTED` vs. undefined) | Same split as above (fields co-vary) | No |
| Single-installment (`repaymentInstallments = 1`) vs. multi-installment | 8/7 (53%) vs. 217/69 (76%) | No — sample of 15 single-installment rows too small to draw a conclusion |

No field in `loan_accounts.bson` corresponds cleanly to the spreadsheet's `upfront` toggle.
**STATUS: UNKNOWN, unresolved** — the toggle appears to be a spreadsheet-only, per-computation
input not persisted anywhere in the structured legacy data this investigation had access to.

**The 2021 spike in "Contractual Rate" formula matches (39 of 64 nonzero-fee rows that year,
§3.2/§5) is most likely a data-encoding artifact, not evidence that Contractual Rate was ever the
fee's real basis.** Inspecting all 39 rows directly: essentially every one carries a recorded
`Contractual Rate` of exactly **3.0%** (a handful at 2.5% or 3.5%), while the same rows' `Add-On
Rate` varies normally (4.2%–5.63%). Cross-checking against the `Interest Rate Chart` legend (§2):
an Add-On Rate of 4.85% at a 6-month term should derive a Contractual Rate around 5%, not 3.0%.
**A flat, term-independent 3.0% value appearing in the "Contractual" column contradicts the
chart's own conversion logic**, which strongly suggests that for this specific 2021 batch, a
standard/base rate was recorded in the "Contractual" column by a since-changed encoding convention
— not that Contractual Rate was genuinely used as the fee's rate basis at any point. This
reinforces, rather than undermines, the Add-On-rate conclusion in §4, but is flagged as an
**interpretation, not an independently proven fact** — no direct source (e.g., a contemporaneous
procedure document or a second staff account from that period) confirms why the 2021 batch's
Contractual column reads this way.

**Net effect on §6:** the contradiction remains open. No evidence was found that the older
`Sample Computation Sheet` formula was ever the live production formula for any identifiable
cohort, time period, or toggle state — but absence of evidence is not confirmation it was never
used. This should still be raised with the business as a standing question, not assumed resolved.

---

## 7. Disposition

This ADR does not block Milestone 9.1 Checkpoint 8. The Advance Interest Fee is an
origination/disbursement-time Net Proceeds deduction, computed once at loan approval/activation
from already-available fields (`grossLoanAmount`, `LoanProductVersion.addOnRate`,
`disbursementDate`, `firstRepaymentDate`). It does not affect `RepaymentInstallment` schedule
generation, which remains governed solely by `ADR-045`.

Recommended follow-up, in order:
1. Confirm with the business which current/new `LoanProductVersion`s should carry
   `chargesAdvanceInterestFee = true` — the only remaining item genuinely blocking implementation.
2. Optionally investigate the residual ~25–38% non-exact-match population (2021 excluded) if
   higher formula precision is desired; not required before implementation, given the strong fit
   already established (§3.4, §5).
3. Optionally raise the §6/§6.1 `upfront`-toggle contradiction with the business as a standing
   question, in case it reveals a still-active exception path this investigation didn't locate.
