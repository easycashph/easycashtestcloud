# ADR-007 — Outstanding Balance Formula

**Status:** ACCEPTED — mechanism decided; §3 (penalty inclusion) **RESOLVED 2026-07-05** (Option B,
two fields); §4 (migration treatment of non-reconciling `CLOSED` loans) **RESOLVED 2026-07-08**
(Option A, migrate as-is and flag for manual review). This ADR is now fully accepted — no open
sections remain.
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

## 3. RESOLVED — Decision: does "outstanding balance" include penalty, or not?

**The evidence shows two differently-scoped balance concepts are both real, both internally
consistent, and both currently in active use in the legacy system — this is not a data error to
be explained away, it is a genuine design fork:**

| Concept | Formula (as evidenced) | Penalty included? | Evidence |
|---|---|---|---|
| Ledger running total | `loan_transactions.balance`, all transaction types | **Yes** | Exact replay match, 3 independent cases |
| Collections-operational total | `Daily Collection Report.xlsx` "Total Balance" | **Yes** | Exact match to the ledger, 1 case (centavo-exact) |
| Accounting/GL total | `Accounting-Detailed Ending Current Balance.xlsx` "Total Obligation" = `PRINCIPAL BALANCE + INTEREST BALANCE + FEES BALANCE` | **No** | Exact match, 1 case, formula independently re-derived and confirmed a second time via `Sample Computation Sheet updated.xlsx`'s `Get Gross (2)` sheet ("Total OB" = Principal + scheduled Add-On interest, no penalty term) |

**Decision (2026-07-05): Option B — two fields, both exposed.**

- **Option A — single field.** `LoanAccount` exposes one `outstandingBalance` concept. Requires
  choosing penalty-inclusive or penalty-exclusive, discarding the other view (or computing it
  on demand elsewhere, e.g. a report query). **Not selected.**
- **Option B — two fields. SELECTED.** `LoanAccount` (or a presenter/reporting layer) exposes
  both a penalty-inclusive "collections balance" and a penalty-exclusive "accounting balance" as
  distinct, separately-named values. This is the Legacy Analysis document's own non-binding
  recommendation (§7.10), on the reasoning that both concepts are already real and in
  simultaneous use, and picking one would silently break whichever downstream report/process
  relies on the other. **Confirmed by direct business decision** (project owner, 2026-07-05):
  both views are needed and neither should be discarded.

**Rationale, for the record:** the evidence confirms *that* the two totals differ by a fixed,
identifiable, formula-level distinction (penalty presence). It does not confirm *why* the
business treats them differently (a plausible but unconfirmed hypothesis is cash-basis vs.
accrual-basis recognition of penalty income — Legacy Analysis §7.4) — that "why" remains
unconfirmed, but is not required to implement Option B: both fields are computed directly from
already-evidenced formulas regardless of the underlying accounting rationale.

**Implementation note for CP11:** name the two getters distinctly and unambiguously — e.g.
`collectionsBalance` (penalty-inclusive: principal + interest + fees + penalty) and
`accountingBalance` (penalty-exclusive: principal + interest + fees). Do not name either one
plain `outstandingBalance`, since that name is exactly the ambiguity this ADR resolves — a
generic name would silently reintroduce the confusion for the next reader. **STATUS: RESOLVED.**

---

## 4. RESOLVED — Decision: how should the new system treat the 15.5% of legacy `CLOSED` loans whose balances don't reconcile to zero?

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

**Options considered:**

- **Option A — migrate as-is, flag for manual review.** Bring all 1,799 legacy loans across
  (including the 79 unreconciled ones) with their balances exactly as recorded, and flag the 79
  for manual accounting review post-migration. Preserves history faithfully; defers the
  discrepancy to a human process rather than software logic.
- **Option B — exclude or specially handle the 79 during migration.** Treat them as a distinct
  migration category (e.g. write them off formally at migration time, using the legacy system's
  own clean `WRITE_OFF` convention as a template, with an explicit migration-time audit trail).
  Requires a decision on whether this is even accounting-appropriate, which is outside what this
  investigation can determine. **Not selected** — see rationale below.
- **Option C — obtain institutional clarification first**, per the Legacy Analysis document's
  standing recommendation (§7.10, §8.14) — someone with knowledge of the legacy system's
  operations could very plausibly resolve the 54.4% "no special marker" category and the
  `REPAYMENT_UNDO`/`IMPORT` correlations quickly, turning "plausible, not proven" into either
  "confirmed" or a firm "no, that's not it, here's what actually happened." Not pursued as a
  precondition — the additional evidence gathered below was judged sufficient to decide without it.

**Decision (2026-07-08): Option A — migrate all 1,799 legacy loans as-is, including the 79
non-reconciling `CLOSED` accounts, with balances exactly as recorded in the legacy export; flag
the 79 as a distinct population for manual accounting review post-migration.**

**Confirmed by direct business decision (Nomer Perez, MIS Manager, 2026-07-08).**

**Additional evidence gathered 2026-07-08 (extends the Legacy Analysis document's §7.3 findings,
same evidence sources — full populations queried directly, not samples):**

- **Year-of-origination distribution of the full 79-loan population** (not just the hand-traced
  examples in §7.3.1) rules out "pandemic-era non-payment" as a sufficient explanation for the
  population as a whole: 2019–2021 originations account for 25 of 79 (31.6%) — a real, plausible
  contributor for that subset — but the single largest cohort is **2023** (35 of 79, 44.3%),
  well after pandemic-era disruption. Full distribution: 2010 (1), 2012 (2), 2015 (9), 2016 (1),
  2017 (2), 2018 (3), 2019 (10), 2020 (7), 2021 (8), 2022 (1), 2023 (35).
- **Product-type breakdown of the 2023 cohort** shows concentration in `SML` (Seafarer/Allotment)
  and `SL` (Salary Loan, including Corporate tie-up) products — 31 of 35 (88.6%): `SML-Self
  Allotment` (8), `SL-Corporate` (8), `SML-Co-Borrower Allotment` (7), `SL-Regular` (6), plus
  smaller counts of `PFL-Gadgets, Appliances`, `BL-Regular`, `SML-Regular`, `BL-Special`,
  `SML-PDC`. Both dominant product families depend on a third party (manning agency or employer)
  to remit payment via allotment/salary deduction — a plausible, **not yet confirmed** shared
  root cause distinct from pandemic non-payment, worth flagging for the post-migration review
  rather than resolving here.
- **Full transaction-history trace of one representative case**, `SML-SPEC_N1U3L` (`SML-Special`,
  disbursed 2020-08-20, 1,218 transactions): the account's balance reached exactly ₱0.00 on
  2025-07-29 (two large `REPAYMENT` postings), but received a further `PENALTY_APPLIED` and `FEE`
  posting the very next day, 2025-07-30 — the last two transactions in the account's entire
  history — leaving a live, un-reconciled balance under a still-`CLOSED` account state. The
  account-level `principalBalance` snapshot (₱278,407.47) also does not match the last
  transaction's own `balance` field (₱133,333.33) on the same record — a second, independent
  discrepancy. This is consistent with a **process gap** (nothing in the legacy system prevents
  further postings against an already-`CLOSED` account) rather than data corruption, and directly
  demonstrates that at least some of the 79 represent **real, not-yet-resolved financial
  positions**, not artifacts safe to discard.

**Rationale for Option A over Option B:** the traced case above shows a real, non-zero balance
arising from legitimate post-closure transactions — an automatic write-off (Option B) would
improperly discharge what may be a genuinely collectible amount. The population is also
demonstrably heterogeneous (§7.3's five-category breakdown: `TRANSFER`, `IMPORT`,
`REPAYMENT_UNDO`, no-marker, plus the 2023/allotment concentration found above) with no single
root cause covering all 79 — a blanket write-off treatment risks discharging genuine receivables
alongside genuine artifacts. Migrating as-is and flagging for case-by-case manual review preserves
the full evidentiary record and defers the write-off/no-write-off judgment, loan by loan, to the
humans best positioned to make it.

**Related, not part of this decision:** a write-off **recovery/reversal mechanism** (for the
general case of a written-off loan later becoming collectible again — e.g. an absconding client
located by a collection agency) was discussed as a good, low-cost, evidence-backed addition
regardless of this decision (the legacy system's own `WRITE_OFF`/`WRITE_OFF_ADJUSTMENT`
transaction pair already demonstrates this pattern was in real use). Since Option A does not
write off the 79 migrated loans, this mechanism is not required to close out this ADR, but should
be designed into any future `WriteOffLoanUseCase` built for ordinary (non-migration) operations.

**STATUS: RESOLVED.**

---

## 5. Confidence summary

| Element | Confidence |
|---|---|
| Balance is a maintained running total, updated atomically per transaction | **CONFIRMED** — decided, §1 |
| Component-field summing is NOT a reliable reconciliation method | **CONFIRMED** — decided, §1 |
| Overpayments/reversals/negative balances are valid states | **CONFIRMED** — decided, §2 (reaffirms `FINANCIAL_INVARIANTS.md §3`) |
| Whether `outstandingBalance` includes penalty | **RESOLVED 2026-07-05 — Option B, both exposed, §3** |
| Cause and migration treatment of the 15.5% non-reconciling `CLOSED` population | **RESOLVED 2026-07-08 — Option A, migrate as-is + flag for manual review, §4** |

---

## 6. What this ADR unblocks and what it still blocks

**Correction (per `MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md` Decision Log #1):** the original
claim below — that §3 blocks every balance-mutating write — was overly conservative and has
since been superseded. §3 only ever blocked a single, narrow future getter (a computed
`outstandingBalance`/`collectionsBalance`/`accountingBalance` summary), never the twelve
individual balance columns (`principalBalance`, `interestBalance`, `feesBalance`,
`penaltyBalance`, and their `Paid`/`Due` counterparts) that `ActivateLoanUseCase` (CP8) and
`ProcessPaymentUseCase` (CP9) actually read and write. Both were implemented, tested, and
committed without needing §3 resolved, exactly as the roadmap's Decision Log #1 concluded. The
original text is preserved below for the historical record, not because it turned out correct:

- ~~Does NOT yet fully unblock `ActivateLoanUseCase` or any balance-mutating write — those
  require §3's decision, since every balance-mutating use case must know which balance
  concept(s) it's writing to.~~ **Superseded — see correction above.**
- **Does unblock**: any calculation-engine work that only needs to know balances are
  transaction-driven, atomically maintained, and never independently re-derived from component
  sums (e.g. `PaymentAllocationService`'s internal design per ADR-009 can proceed knowing it will
  write against a maintained running total, without yet knowing whether that total is one field
  or two).
- ~~**Does not block** migration-scoping discussions from starting (§4's options can be discussed
  and narrowed even before a final decision), but a concrete migration script should not be
  written against the 79-loan population until §4 is resolved.~~ **Superseded — §4 is now
  resolved; CP12 may be scoped and built against Option A (migrate as-is, flag the 79 for manual
  review).**

**Now that both §3 (2026-07-05) and §4 (2026-07-08) are resolved, this ADR is fully ACCEPTED.**
CP11 (the `outstandingBalance` summary getter, `collectionsBalance`/`accountingBalance` per §3's
implementation note) was already unblocked and shipped. **CP12 (the legacy-migration checkpoint
for all 1,799 loans, including the 79 non-reconciling `CLOSED` accounts per §4's Option A) is now
unblocked and may be scoped** — per `docs/LMS_PROJECT_SUMMARY.md` §4.3, this should happen
alongside standing up a real PostgreSQL instance, since migration work cannot be meaningfully
verified without one.

This ADR remains "PARTIALLY ACCEPTED" (not "Accepted") until §4 is also resolved.
