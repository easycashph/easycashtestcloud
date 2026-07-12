# ADR-050 — Penalty Calculation Formula (New Loans, Prospective Only)

**Status:** ACCEPTED — rate, grace period, compounding behavior, and rate tiering all confirmed by
direct business/MIS testimony (2026-07-11 session). Explicitly a **new, going-forward policy** —
not a claim about what the legacy SDevTech system historically computed (see §3 for the legacy
evidence this ADR deliberately does NOT try to match). Does not affect any already-migrated loan's
stored penalty figures (see §5, Disposition).

**Context documents:** `docs/Architecture/CALCULATION_ENGINE_SPEC.md` §12 (previously
`STATUS: UNRESOLVED`, blocked on this ADR and on the legacy `PENALTY_APPLIED` sequence — this ADR
resolves the policy question directly via business testimony instead of further legacy-data
archaeology); `app/backend/prisma/schema.prisma`'s `PenaltyRule` model (`calculationMethod`,
`ratePercent`, `capPercent`, `gracePeriodDays` — already shaped for exactly this rule, no schema
redesign needed); BSP Circular No. 1133 (2021) / SEC Memorandum Circular No. 3, Series of 2022
(the regulatory ceiling that motivated the two-tier rate — see §2).

---

## 1. The rule, as confirmed directly by the user (MIS)

- **Rate:** 10% per month on unsecured loans; **5% per month** on unsecured loans with principal
  **₱10,000 or below** (regardless of tenor — see §2 for why tenor doesn't matter here).
- **Basis:** the overdue **Principal + Interest** for the installment (not principal alone) — the
  user explicitly chose this over a principal-only basis when asked.
- **Grace period:** 3 days from the due date. No penalty at all if paid within the grace period —
  a pure yes/no gate on whether any penalty applies, not a shift in where month-counting starts
  (see the worked example: months late are counted from the original due date, not from the day
  the grace period ends — see `CALCULATION_ENGINE_SPEC.md` §12's Formula for why anchoring at
  grace-end instead would give a different, unconfirmed answer).
- **Compounding:** compounded monthly — each month's penalty is 10% (or 5%) of the *prior
  cumulative balance* (overdue amount + all previously-accrued penalty), not a fresh 10% of the
  original overdue amount each time.
- **Partial months:** **not prorated.** Only fully-completed months (counted from the due date)
  trigger another compounding step; a partial month in progress contributes nothing yet.
- **All Easycash loans are unsecured** (user-confirmed, 2026-07-11) — so the 5%-vs-10% split is
  driven by principal amount alone, not by a secured/unsecured distinction.

### Worked example (confirmed with the user directly)

Loan installment due 2026-07-01, ₱10,000.00 overdue (Principal + Interest), 10% rate, paid
2026-10-01 (exactly 3 whole months after the due date — past the 3-day grace period, so penalty
applies):

| Month | Starting balance | Penalty (rate × balance) | Ending balance |
|---|---|---|---|
| 1 | ₱10,000.00 | ₱1,000.00 | ₱11,000.00 |
| 2 | ₱11,000.00 | ₱1,100.00 | ₱12,100.00 |
| 3 | ₱12,100.00 | ₱1,210.00 | ₱13,310.00 |

Total penalty = ₱3,310.00. Equivalently: `OverdueAmount × ((1 + Rate)^MonthsLate − 1)`.

---

## 2. Why the 5% tier ignores tenor, even though BSP Circular 1133 doesn't

BSP Circular No. 1133 (2021), implemented via SEC Memorandum Circular No. 3 (2022), caps the late-
payment penalty at **5% per month** — but only for loans that are simultaneously (a) unsecured,
(b) general-purpose, (c) ₱10,000 principal or below, **and** (d) 4-month tenor or below. A ₱10,000
loan with a 6-month tenor is not, strictly, "covered" by the circular's own scope.

The user was asked directly whether the 5% tier should also require the 4-month tenor condition,
and confirmed **no** — any unsecured loan ≤₱10,000 gets 5%, regardless of tenor. This is
deliberately **more conservative than the regulation requires** (applying the lower rate to a
broader set of loans than the circular strictly mandates), which is a voluntary, borrower-
favorable choice, not a compliance gap — a regulatory ceiling caps a maximum; nothing prevents a
lender from applying an even lower rate to loans the ceiling doesn't strictly reach. This ADR
records that reasoning but is **not a legal compliance opinion** — Easycash's own legal/compliance
function should independently confirm this treatment, particularly for the >₱10,000, 10%-tier loans
this circular's specific ceiling does not address at all (general "iniquitous penalty" reduction
under Civil Code Art. 2227 remains a separate, always-available judicial backstop regardless of
loan size).

---

## 3. Legacy evidence exists but is deliberately NOT what this ADR implements

`CALCULATION_ENGINE_SPEC.md` §12 (prior to this ADR) documented a real, observed legacy pattern:
`loan_accounts.bson` records `penalty_calculation_method: "PERCENTAGE_PER_DAY"` and a `penalty_rate`
per account, and the real `PENALTY_APPLIED` transaction sequence for one sampled account
(`SML-MAX_K5W8S`) was `77.68, 155.36, 233.04, 310.72, 388.40, 466.08` — each step exactly **+77.68**
from the last. That is a **linear (arithmetic)** progression, not a compounding (geometric) one —
structurally inconsistent with the compounded-monthly rule this ADR adopts.

Asked directly about this discrepancy, the user confirmed: the 10%/5% compounded rule is a **new,
current policy**, not a claim that it matches how the legacy system computed penalties
historically. This ADR does not attempt to reconcile the two — the legacy linear pattern remains an
open, unexplained artifact of the old system (possibly a different per-day-simple-interest
mechanism, `PERCENTAGE_PER_DAY` read literally), but it is explicitly out of scope here per the
user's own instruction to use the new rule going forward regardless.

---

## 4. Applies uniformly to every product — rate resolved per loan, not per product version

**2026-07-11 follow-up, user decision: this rule applies to all loan products, not a
product-by-product configuration.** This ADR originally proposed setting `PenaltyRule.ratePercent`
to 5 or 10 per `LoanProductVersion` (small-loan products get 5, the rest get 10) — reconsidered and
rejected: a single product's `LoanProductVersion` can span both sides of the ₱10,000 line (e.g.
`SML-Regular`'s `loanAmountMin`/`loanAmountMax` range covers loans both above and below it), so a
single fixed rate per product version cannot correctly express "5% if *this specific loan's*
principal is ≤₱10,000." The tier must be evaluated **per loan, from that loan's own
`principalAmount`** — uniformly, the same rule for every product.

There's a second reason this doesn't fit `PenaltyRule`'s existing per-`LoanProductVersion` model
cleanly: `PenaltyRule` is part of the immutable rule snapshot on each *version* (LPV-1) — most
existing `LoanProductVersion` rows are already-migrated (CP12), carrying legacy-derived
`PenaltyRule` values (`PERCENTAGE_PER_DAY`, rate `5`, per §3's evidence) that must not be edited
in place (LPV-3: editing a product must never affect historical loans referencing that same
version). Retrofitting this ADR's rule onto existing versions would mean creating and activating a
new `LoanProductVersion` per product — real, but separate, product-configuration work this ADR
does not require as a precondition.

**Implementation: a global rule, not per-product configuration.** `gracePeriodDays = 3`,
`principalThreshold = ₱10,000`, `rateBelowThreshold = 5%`, `rateAtOrAboveThreshold = 10%`, and
`calculationMethod = OVERDUE_BALANCE_AND_INTEREST` (Principal + Interest basis) apply identically
to every loan, resolved at penalty-calculation time from that loan's own `principalAmount` — not
read from a per-`LoanProductVersion` `PenaltyRule` row. `PenaltyRule`'s schema fields remain
available, unused by this feature, for a future genuinely-per-product penalty policy if one is ever
confirmed (YAGNI: not built until needed).

Compounding and whole-months-only counting are likewise fixed behavior of the calculation itself,
not configurable per product — the user described these as universal, not something that varies.

`capPercent` (the 100%-of-principal total cost cap BSP Circular 1133 also imposes) is not addressed
by this ADR — still `ADR-008 PENDING` per the schema's own comment, a separate, broader question
spanning interest + fees + penalty together.

---

## 5. Disposition — prospective only, migrated data untouched

**This formula applies only to loans originated going forward through this system** (i.e., new
loans created and activated after this feature ships). Explicitly, per the user's own decision:

- **Already-migrated loans' stored `penaltyDue`/`penaltyPaid`/`penaltyBalance` values are never
  recomputed or overwritten by this formula** — they remain exactly as migrated (CP12), a
  historical record of what the legacy system actually charged, consistent with this project's
  standing "never modify legacy data during migration" principle and the same LA-4 immutable-
  snapshot philosophy already applied to `interestRate`/`addOnInterestRate`/`contractualInterestRate`.
  These loans do not receive live-computed penalty from this feature, even if still ACTIVE and
  overdue today — that transition (if ever wanted) is an explicitly deferred, separate decision,
  not part of this ADR.
- New loans compute penalty live (as-of "today") for display and payment-allocation purposes,
  using each loan's own `PenaltyRule` snapshot (rate, grace period) taken at approval time — never
  recomputed from a later product edit, per the same LPV-1/LA-4 pattern every other snapshotted
  rule in this system already follows.

## 6. Confidence summary

| Claim | Status |
|---|---|
| Rate: 10%/month (>₱10k unsecured), 5%/month (≤₱10k unsecured) | **CONFIRMED** — direct user/MIS testimony |
| All Easycash loans are unsecured | **CONFIRMED** — direct user testimony |
| Grace period: 3 days | **CONFIRMED** — direct user testimony |
| Basis: overdue Principal + Interest | **CONFIRMED** — direct user testimony |
| Compounded monthly | **CONFIRMED** — direct user testimony |
| Partial months not prorated (whole months only) | **CONFIRMED** — direct user testimony |
| 5% tier ignores tenor (BSP's own 4-month condition not applied) | **CONFIRMED, user's explicit choice** — more conservative than the regulation requires, not a compliance gap for the ≤₱10k tier; not a legal opinion on the >₱10k tier |
| This matches what the legacy system historically computed | **DISCONFIRMED / not claimed** — legacy `PENALTY_APPLIED` evidence shows a linear, not compounding, pattern; user confirmed this ADR is a new policy, not a historical match |
| Applies to already-migrated loans | **DISCONFIRMED, by explicit user decision** — prospective only; migrated penalty data stays untouched |
| `capPercent` (100%-of-principal total cost cap) enforcement | **UNRESOLVED** — still `ADR-008 PENDING`, out of scope here |

---

## 7. Disposition / follow-up

1. `CALCULATION_ENGINE_SPEC.md` §12 updated from `UNRESOLVED` to `CONFIRMED` (this formula), with
   the prospective-only scope note carried over.
2. Implementation: a pure, unit-tested `PenaltyCalculator` domain function first (the formula
   itself, no I/O), then a live-computed display for new loans' overdue installments — payment-
   allocation integration (actually letting a penalty be paid off through Payment Recording) is a
   separate, not-yet-scoped follow-up.
3. Which specific `LoanProductVersion`s get `ratePercent = 5` vs `10` is a data-entry/product-
   configuration task once the calculation engine exists, not a schema or formula question this ADR
   needs to resolve further.
4. `capPercent`/`ADR-008` (the 100%-of-principal total cost cap) remains a separate, still-open item.
