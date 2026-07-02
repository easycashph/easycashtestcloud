# ADR-007 — Outstanding Balance Formula

**Status:** PARTIALLY ACCEPTED — mechanism decided; two central design questions explicitly
UNRESOLVED, pending a business decision (Milestone 9 design review, 2026-07-03).
**Context documents:** `docs/Legacy Analysis/2026-07-03-milestone9-financial-rules-verification.md`
§3.1, §7.3–§7.5, §7.9–§7.10 (evidence); `docs/Architecture/FINANCIAL_INVARIANTS.md` §3, §8 (prior
open-item listing and the balance-integrity invariants this ADR must operate within).
**Evidence sources:** `legacy/mongodb/.../loan_accounts.bson`, `loan_transactions.bson`;
`legacy/reports/Accounting-Detailed Ending Current Balance.xlsx`; `legacy/reports/Daily
Collection Report.xlsx`.

---

## Why this ADR is incomplete, stated up front

Per explicit instruction, this document does **not** invent a resolution to two genuine,
evidence-confirmed contradictions that remain undecided. Sections 1–2 record what the evidence
**does** settle (a mechanism). Sections 3–4 record what it does **not** settle (two central design
questions), each with the evidence for every option laid out, and no option selected. This ADR
cannot be marked fully "Accepted" until you decide §3 and §4. This is a deliberate choice,
consistent with `PROJECT_RULES.md`'s "if the repository cannot prove a business rule, explicitly
identify what evidence is required" instruction — guessing here would put fabricated financial
logic into the specification, which is explicitly less acceptable than leaving this document
unfinished.

---

## 1. What IS decided: the balance is a running total, reconstructible by replaying the ledger's own `balance` field — not by summing transaction components

**Confirmed, exact match, multiple independent cases:** the legacy ledger's `balance` field
(`loan_transactions.balance`) is a single running total, updated by every transaction type, that
replays exactly against real data. Two clean single-installment loans (`SL-LAZ_V5N0R`,
`SL-LAZ_A6J8E`) were hand-verified to the centavo; a third independent verification came from
cross-matching `SL-REG_00099`'s final `REPAYMENT` transaction (`balance: 4524.17`) against the
identical value in `Daily Collection Report.xlsx`'s "Total Balance" column for the same
account/date.

**Confirmed, and important: this replay works using the `balance` field's own value at each step
— it does NOT work by independently summing the `principal_amount`/`interest_amount`/
`fees_amount`/`penalty_amount` component fields across a loan's full history.** A directly
observed inconsistency (Legacy Analysis §7.5) shows these component fields do not have uniform
semantics across the legacy dataset: for the same transaction type (`PENALTY_APPLIED`), some
loans show `principal_amount: 0` (a pure delta), while other loans show `principal_amount`
populated with a value matching the account's *current* principal-balance snapshot at that
moment (not a delta at all). This inconsistency was found on real records for different loans,
not theorized.

**Decision: the new system's balance-tracking mechanism must be a maintained running total,
updated atomically within the same database transaction as each `LoanTransaction` insert
(exactly as `FINANCIAL_INVARIANTS.md §3` already specifies) — never a value re-derived on demand
by summing historical component fields.** This part of ADR-007 is settled and requires no further
input.

---

## 2. What IS decided: overpayments, reversals, and negative balances are valid states, not errors

This is not a new finding — it restates and formally accepts `FINANCIAL_INVARIANTS.md §3`'s
existing requirement, now with legacy corroboration: the legacy ledger's `WRITE_OFF` mechanism
(15 occurrences, checked) and its `REVERSAL`/`*_UNDO`/`*_ADJUSTMENT` transaction types (34
distinct types catalogued) all demonstrate a system comfortable with balances moving in either
direction for legitimate business reasons. No evidence contradicts `Money`'s existing design
decision (no "negative is illegal" type constraint) — this ADR reaffirms it.

---

## 3. UNRESOLVED — Decision Required: does "outstanding balance" include penalty, or not?

**The evidence shows two differently-scoped balance concepts are both real, both internally
consistent, and both currently in active use in the legacy system — this is not a data error to
be explained away, it is a genuine design fork:**

| Concept | Formula (as evidenced) | Penalty included? | Evidence |
|---|---|---|---|
| Ledger running total | `loan_transactions.balance`, all transaction types | **Yes** | Exact replay match, 3 independent cases |
| Collections-operational total | `Daily Collection Report.xlsx` "Total Balance" | **Yes** | Exact match to the ledger, 1 case (centavo-exact) |
| Accounting/GL total | `Accounting-Detailed Ending Current Balance.xlsx` "Total Obligation" = `PRINCIPAL BALANCE + INTEREST BALANCE + FEES BALANCE` | **No** | Exact match, 1 case, formula independently re-derived and confirmed a second time via `Sample Computation Sheet updated.xlsx`'s `Get Gross (2)` sheet ("Total OB" = Principal + scheduled Add-On interest, no penalty term) |

**Options, neither selected by this document:**

- **Option A — single field.** `LoanAccount` exposes one `outstandingBalance` concept. Requires
  choosing penalty-inclusive or penalty-exclusive, discarding the other view (or computing it
  on demand elsewhere, e.g. a report query).
- **Option B — two fields.** `LoanAccount` (or a presenter/reporting layer) exposes both a
  penalty-inclusive "collections balance" and a penalty-exclusive "accounting balance" as
  distinct, separately-named values. This is the Legacy Analysis document's non-binding
  recommendation (§7.10), on the reasoning that both concepts are already real and in
  simultaneous use, and picking one would silently break whichever downstream report/process
  relies on the other.

**Why this isn't decided here:** the evidence confirms *that* the two totals differ by a fixed,
identifiable, formula-level distinction (penalty presence). It does not confirm *why* the
business treats them differently (a plausible but unconfirmed hypothesis is cash-basis vs.
accrual-basis recognition of penalty income — Legacy Analysis §7.4) or *which one, or both, the
new system's core domain model should expose as its canonical `outstandingBalance`*. This is a
product/accounting decision, not a data question. **STATUS: UNRESOLVED — requires your decision.**

---

## 4. UNRESOLVED — Decision Required: how should the new system treat the 15.5% of legacy `CLOSED` loans whose balances don't reconcile to zero?

This question only matters for **migration** of legacy loan history into the new system, not for
the calculation engine's forward-looking correctness (§1's decision holds regardless) — but it is
a real, quantified population that any migration plan must account for, and it is closely coupled
to §3's decision (a "closed but unreconciled" loan's classification may depend on which balance
concept is being reconciled against).

**What the evidence shows (Legacy Analysis §7.3, full population of 79 non-reconciling `CLOSED`
accounts, not a sample):**

| Category | Count | % of 79 | Resolution status |
|---|---|---|---|
| Loan-to-loan `TRANSFER` present | 3 | 3.8% | **Explained** — confirmed benign, the other leg of the transfer lives on a different account |
| `IMPORT` marker(s) present | 15 | 19.0% | **Plausible, not proven** — correlates with a migration boundary; the causal mechanism (pre-migration history gap) wasn't directly observed |
| `REPAYMENT_UNDO` present, unlinked to what it corrects | 18 | 22.8% | **Plausible, not proven** — a real reversal-style mechanism exists but wasn't traced end-to-end for each case |
| Formal `WRITE_OFF` used | 0 | 0% | **Ruled out** as the cause — `WRITE_OFF`, when used elsewhere in the system, reconciles perfectly |
| No special marker | 43 | 54.4% | **Unresolved** — a recurring "small residual + late penalty + delayed final repayment" pattern was observed in a subset (3 of 8 hand-traced examples), consistent with a timing artifact of when the export was taken rather than corruption, but this is offered as the most evidence-consistent interpretation, not a proven cause, and doesn't cover the remaining hand-traced examples, which show larger, more actively-disputed-looking histories with no single clean explanation |

Explicitly ruled out as causes, per investigation (Legacy Analysis §7.3.2): legacy data
corruption (no orphaned/dangling references found), deleted records (cannot be proven or
disproven from an export — genuinely unknowable from this evidence), and rounding differences
(plausible only for the smallest-magnitude cases; the largest unreconciled amount is ₱692,813.97,
far too large to be a rounding artifact).

**Options, neither selected by this document:**

- **Option A — migrate as-is, flag for manual review.** Bring all 1,799 legacy loans across
  (including the 79 unreconciled ones) with their balances exactly as recorded, and flag the 79
  for manual accounting review post-migration. Preserves history faithfully; defers the
  discrepancy to a human process rather than software logic.
- **Option B — exclude or specially handle the 79 during migration.** Treat them as a distinct
  migration category (e.g. write them off formally at migration time, using the legacy system's
  own clean `WRITE_OFF` convention as a template, with an explicit migration-time audit trail).
  Requires a decision on whether this is even accounting-appropriate, which is outside what this
  investigation can determine.
- **Option C — obtain institutional clarification first**, per the Legacy Analysis document's
  standing recommendation (§7.10, §8.14) — someone with knowledge of the legacy system's
  operations could very plausibly resolve the 54.4% "no special marker" category and the
  `REPAYMENT_UNDO`/`IMPORT` correlations quickly, turning "plausible, not proven" into either
  "confirmed" or a firm "no, that's not it, here's what actually happened."

**STATUS: UNRESOLVED — requires your decision**, and does not block calculation-engine
implementation work (§1's decision is independent of this migration-time question), but does
block a complete, confident migration plan.

---

## 5. Confidence summary

| Element | Confidence |
|---|---|
| Balance is a maintained running total, updated atomically per transaction | **CONFIRMED** — decided, §1 |
| Component-field summing is NOT a reliable reconciliation method | **CONFIRMED** — decided, §1 |
| Overpayments/reversals/negative balances are valid states | **CONFIRMED** — decided, §2 (reaffirms `FINANCIAL_INVARIANTS.md §3`) |
| Whether `outstandingBalance` includes penalty | **UNRESOLVED — decision required, §3** |
| Cause and migration treatment of the 15.5% non-reconciling `CLOSED` population | **PARTIALLY CONFIRMED (quantified by category); UNRESOLVED overall — decision required, §4** |

---

## 6. What this ADR unblocks and what it still blocks

- **Does NOT yet fully unblock `ActivateLoanUseCase` or any balance-mutating write** — those
  require §3's decision, since every balance-mutating use case must know which balance
  concept(s) it's writing to.
- **Does unblock**: any calculation-engine work that only needs to know balances are
  transaction-driven, atomically maintained, and never independently re-derived from component
  sums (e.g. `PaymentAllocationService`'s internal design per ADR-009 can proceed knowing it will
  write against a maintained running total, without yet knowing whether that total is one field
  or two).
- **Does not block** migration-scoping discussions from starting (§4's options can be discussed
  and narrowed even before a final decision), but a concrete migration script should not be
  written against the 79-loan population until §4 is resolved.

This ADR should be revisited and formally completed (its Status changed from "PARTIALLY ACCEPTED"
to "Accepted") once you have decided §3 and §4.
