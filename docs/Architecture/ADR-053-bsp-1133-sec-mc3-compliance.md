# ADR-053 — BSP Circular 1133 / SEC MC 3 Compliance (Interest Rate, Penalty, EIR, and Total Cost Ceilings)

**Status:** IN PROGRESS — Phase 1 (coverage classification) and Phase 2 (simple-interest penalty
formula for covered loans) implemented and tested. Phases 3-5 (below) are deferred, scoped
follow-up work, not yet built.

**Context documents:** `legacy/SEC/BSP1133.pdf` (the actual circular text, user-supplied
2026-07-20); `legacy/SEC/2022FAQs_Sample-Computations-on-SEC-MC-3__14June2022.pdf` (SEC's own FAQ
with worked EIR examples, same source). Both read in full before any code was written — see this
ADR's citations throughout.

---

## 1. What the regulation requires

BSP Circular No. 1133, Series of 2021, implemented by SEC Memorandum Circular No. 3, Series of
2022, prescribes ceilings on interest rates and other fees for a specific, narrow class of loans
offered by Lending Companies (LCs), Financing Companies (FCs), and their Online Lending Platforms
(OLPs).

**Coverage — ALL FOUR criteria must hold concurrently** (SEC MC 3 FAQ §II.2, its own emphasis: "If
one of the four components is not satisfied, the caps will not apply to the loan product"):

a. Unsecured, general-purpose loan.
b. Principal amount does not exceed ₱10,000.
c. Loan tenor of up to four (4) months.
d. Entered into, restructured, or renewed on or after 03 March 2022 (SEC MC 3's effectivity date).

**Ceilings for covered loans** (BSP Circular 1133 §1):

| # | Item | Ceiling |
|---|---|---|
| 1 | Nominal Interest Rate | 6%/month (~0.2%/day) |
| 2 | Effective Interest Rate (EIR) — nominal interest + all other fees/charges (processing, service, notarial, handling, verification), EXCLUDING penalties/late-payment fees | 15%/month (~0.5%/day) |
| 3 | Penalty for late payment or non-payment | **5% per month on outstanding scheduled amount due** |
| 4 | Total Cost (all interest + other fees/charges + penalties combined) | **100% of total amount borrowed**, regardless of how long the loan has been outstanding |

EIR is computed via the IRR (internal rate of return) function over the loan's actual cash flows
(disbursement, then each repayment) — see the FAQ's 8 worked Sample Illustrations for the exact
methodology; not re-derived here, cited for Phase 3's future implementation.

## 2. Gap analysis against this system, as of 2026-07-20

| Requirement | Status |
|---|---|
| Penalty cap: 5%/month, simple (non-compounding) | **Gap.** ADR-050's system-wide penalty formula (used e.g. on the Loan Detail page) compounds monthly — for a covered loan 2 months late, ADR-050 charges ~10.25% vs. the regulation's 10% simple. ADR-052's new SOA-specific penalty formula is non-compounding, but tiers 5%/10% by each installment's own unpaid balance, not by whether the LOAN is SEC-MC3-covered — a different, unrelated distinction. |
| Total Cost Cap: 100% of principal | **Gap.** No enforcement anywhere in the system. |
| EIR cap: 15%/month | **Gap.** No EIR (IRR-based) computation or validation exists anywhere in the system, including at loan origination. |
| Nominal Interest Rate cap: 6%/month | **Unverified.** Depends on each covered product's configured `defaultInterestRate`/`minInterestRate`/`maxInterestRate` (`LoanProductVersion`) — not audited as part of this ADR; a follow-up task. |
| A way to identify which loans are SEC-MC3-covered at all | **Solved by Phase 1 (this ADR).** |

**Real exposure confirmed in the live database (2026-07-20):** 43 real `LoanAccount` rows match
criteria (b), (c), and (d) (principal ≤ ₱10,000, tenor ≤ 4 months, originated on/after 2026-03-03 —
several currently `ACTIVE` or `ACTIVE_IN_ARREARS`), across products the user confirmed also satisfy
(a): `SP-Flash`, `SL-LAZ`, `SML-REG`, `PFL-GAD`. This is not a hypothetical/future concern — these
are today's real client loans.

## 3. Phase 1 (implemented) — coverage classification

**`LoanProduct.isUnsecuredGeneralPurpose`** (new `Boolean @default(false)` column, migration
`20260720022158_add_loan_product_sec_mc3_classification`) — criterion (a), a product-level
classification (doesn't vary by `LoanProductVersion`, since whether a product is secured/
specific-purpose is a property of the product type, not its pricing terms). Defaults to `false`
("not yet confirmed unsecured/general-purpose," not "confirmed secured") for every product until a
human explicitly confirms it — never inferred or guessed (CLAUDE.md: never fabricate compliance
logic).

**Confirmed `true` so far** (2026-07-20, direct user confirmation): `SP-Flash`, `SL-LAZ`,
`SML-REG`, `PFL-GAD`.

**NOT yet reviewed** (remain `false` by default, pending explicit confirmation — deliberately not
assumed from name similarity to the confirmed four): `SL-LAZ-NEW`, `SL-LAZ-PRM`, `SL-OL`,
`SL-OL_NEW` (despite resembling the confirmed `SL-LAZ`/general online-loan pattern), and every
other product in the catalog (`SL-REG`, `SL-CORP`, `BL-REG`, `SL-Snap-A`, `SML-PDC`, `SL-Snap-B`,
`REL-REG`, `SML-SPEC`, `PFL-MOTOR`, `CL-REG`, `BL-SPEC`, `CL-SPEC`, `OFW`, `SML-Kab`, `SP-Easy`,
`SML-Cob`, `OTH-COMP`, `SML-Self`, `PL-S`). This is an explicit follow-up task, not an oversight —
classifying these requires business/legal judgment (is the product secured by collateral? is its
purpose restricted?) this system cannot infer.

**`isSecMc3Covered()`** (`src/shared/domain/compliance/SecMc3Coverage.ts`, pure function, 10 unit
tests in `tests/unit/shared/compliance/SecMc3Coverage.test.ts`) — evaluates all four criteria
concurrently given `(principalAmount, installmentCount, isUnsecuredGeneralPurpose,
originationDate)`. Also exports the four ceiling constants
(`SEC_MC3_PENALTY_RATE_PERCENT_PER_MONTH`, `SEC_MC3_NOMINAL_RATE_CEILING_PERCENT_PER_MONTH`,
`SEC_MC3_EIR_CEILING_PERCENT_PER_MONTH`, `SEC_MC3_TOTAL_COST_CAP_PERCENT`) for Phases 2-5 below to
consume, so the numbers live in exactly one place.

Not yet wired into any use case, controller, or UI — this phase only establishes the
classification data and the pure coverage predicate. No behavior (penalty calculation, loan
origination validation, etc.) changes yet.

## 4. Phase 2 (implemented) — simple-interest penalty formula for covered loans

**`PenaltyCalculator.calculateSimple()`** (`src/shared/domain/calculation/PenaltyCalculator.ts`) —
same grace-period/whole-months-late gating as the existing `calculate()` (ADR-050), but LINEAR
(`overdueAmount × rate × monthsLate`), not compounding. 4 new unit tests confirming it diverges
from `calculate()` once 2+ whole months have elapsed (compounding always charges more) and matches
it exactly at 1 month (where simple and compound are mathematically identical).

**`CurrentPenaltyResolver.resolveComputedPenalty()`** — `PenaltyComputationContext` gained a third
field, `isSecMc3Covered: boolean`. When true, calls `calculateSimple()` with the SEC MC3 5% ceiling
INSTEAD of the ADR-050 rate/compounding path (not layered on top of it) — a covered loan's penalty
is computed one way or the other, never both.

**`resolveSecMc3Coverage()`** (`src/modules/loan-account/application/services/SecMc3CoverageResolver.ts`)
— the glue that resolves `isSecMc3Covered` for a given `LoanAccount` by looking up its product's
`isUnsecuredGeneralPurpose` flag (a 2-hop lookup: version → product) and calling `isSecMc3Covered()`
from Phase 1. Wired into every call site that previously built a `PenaltyComputationContext`:
`RepaymentController` (`listForLoan`, `get`, `reducePenalty`, `adjustFees` — all 4 read paths that
present a live penalty figure) and `ReducePenaltyUseCase` (the reduction's validation ceiling).
`app.ts` wiring updated to pass `loanProductRepository` into both.

**Effect:** for the 43 already-identified covered loans, the Loan Detail page's live penalty
display, the Reduce Penalty validation ceiling, and any other read path through
`resolveComputedPenalty()` now compute penalty using the regulation's own simple 5%/month formula
instead of ADR-050's compounding one — for loans NOT confirmed covered, behavior is completely
unchanged (verified: full backend suite, 758/758, `tsc --noEmit` clean on both apps).

**Not changed by Phase 2:** the frozen, ledger-facing `due.penalty`/`penaltyOverride` figures
(`resolveEffectivePenaltyDue()`) are untouched — this phase only affects the LIVE/projected penalty
figure shown to staff and used as the Reduce Penalty ceiling, matching the same distinction ADR-050
itself already drew between "live projection" and "posted/collectible" penalty.

## 5. Deferred phases (not built yet — scoped here for continuity)

- **Phase 3 — EIR validation at origination.** Compute EIR via IRR over the loan's actual
  disbursement/repayment cash flows (per the FAQ's 8 worked examples) and block/flag approval of a
  covered loan whose EIR exceeds 15%/month.
- **Phase 4 — Total Cost Cap enforcement.** Cap cumulative interest + fees + penalties at 100% of
  principal for covered loans, regardless of how long overdue — needs a decision on mechanism
  (hard cap at posting time vs. a flag/warning for staff review).
- **Phase 5 — Historical review.** Determine (with the user's compliance/legal function) whether
  any of the 43 already-covered loans were charged penalty/fees inconsistent with these ceilings
  under the prior (uncapped, compounding) formula, and whether remediation is required. This is a
  business/legal decision, not a code change, and is explicitly out of scope for this ADR to decide
  unilaterally.
- **Nominal Interest Rate audit.** Confirm each of the 4 (and any newly confirmed) covered
  products' configured interest rates don't exceed 6%/month.

## 6. Whether Easycash is an LC or FC

**Confirmed 2026-07-20 (user): Easycash is a Lending Company (LC).** Relevant because the SEC MC 3
non-compliance penalty schedule differs by entity type (FAQ §IV) — for LCs specifically:

| Violation | 1st offense | 2nd offense | 3rd offense |
|---|---|---|---|
| §3 ceilings (interest/fees) | ₱25,000 | ₱50,000 | SEC discretion: fine (2x 2nd offense, up to ₱1,000,000) and/or 60-day suspension and/or CA revocation and/or registration suspension/revocation |
| §4 (Impact Evaluation Report) | ₱10,000 + ₱100/day | Suspension of CA | Revocation of CA |
| §5 (Business Plan, late/non-submission) | ₱10,000 + ₱100/day (late) | Suspension or Revocation of CA (non-submission / unapproved amendment) | — |
