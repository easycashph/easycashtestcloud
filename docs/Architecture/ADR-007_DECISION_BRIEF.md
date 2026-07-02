# ADR-007 Decision Brief — Outstanding Balance Formula & Legacy Migration Treatment

**Status:** Decision-support document for human review. **This is not an ADR.** It presents
evidence, tradeoffs, and recommendations; it does not decide anything. `ADR-007-outstanding-
balance-formula.md` remains **PARTIALLY ACCEPTED** until the decisions below are made, at which
point that ADR should be amended (not this document) to reflect them.
**Prepared:** Milestone 9, 2026-07-03.
**Audience:** you, for a business/architecture decision. No further data mining is expected to
change the facts presented here — see each section's Confidence Level for what more evidence
could still add.
**Sources drawn on:** `docs/Legacy Analysis/2026-07-03-milestone9-financial-rules-verification.md`
(all sections); `docs/Architecture/ADR-007-outstanding-balance-formula.md`,
`ADR-009-payment-allocation-order.md`, `ADR-010-addon-vs-contractual-interest.md`,
`ADR-financial-audit-isolation.md`, `ADR-optimistic-concurrency.md`,
`CALCULATION_ENGINE_SPEC.md`, `FINANCIAL_INVARIANTS.md`; `PROJECT_RULES.md`; `PROJECT_HANDOFF.md`;
`app/backend/prisma/schema.prisma`. No new legacy data was examined to prepare this brief — it is
a synthesis of evidence already gathered, not a new investigation.

---

## How to read this document

Every fact below is labeled one of three ways, and they are never merged into one statement:

- **CONFIRMED FACT** — directly verified against legacy evidence, cited to its source.
- **OBSERVED CONTRADICTION** — two or more confirmed facts that cannot both be true of a single
  design without a choice being made.
- **BUSINESS DECISION REQUIRED** — a question this investigation cannot answer from data alone,
  because the data shows *what* the legacy system did, not *why*, or shows two equally legitimate
  paths without a tiebreaker.

---

## Decision 1 — Should `outstandingBalance` include penalties?

### Current evidence

**CONFIRMED FACT:** the legacy transaction ledger's running `balance` field
(`loan_transactions.balance`) is an all-inclusive total — it is updated by every transaction
type, including `PENALTY_APPLIED`, and was verified to replay exactly (to the centavo) against
real transaction histories on three independent loans (`SL-LAZ_V5N0R`, `SL-LAZ_A6J8E`,
`SL-REG_00099`). Source: Legacy Analysis §3.1, §7.4.

**CONFIRMED FACT:** `legacy/reports/Daily Collection Report.xlsx`'s "Total Balance" column
matches the ledger's `balance` field exactly (verified on `SL-REG_00099`, `4,524.17` in both
places, to the centavo) — an account whose history includes multiple penalty postings. This
report is therefore also penalty-inclusive. Source: Legacy Analysis §7.4.

**CONFIRMED FACT:** `legacy/reports/Accounting-Detailed Ending Current Balance.xlsx`'s "Total
Obligation" column is computed as `PRINCIPAL BALANCE + INTEREST BALANCE + FEES BALANCE` —
verified exact match against `loan_accounts.bson`'s stored fields for the same account
(`SL-LAZ_T6U2M`: `2,000 + 49.8 + 0 = 2,049.8`, matching the report row exactly). **Penalty is not
a term in this formula.** Source: Legacy Analysis §3.1.

**CONFIRMED FACT:** a third, independent source computed at loan *origination* (before any
penalty could exist) — `Sample Computation Sheet updated.xlsx`, hidden sheet `Get Gross (2)`,
cell `D23`, explicitly labeled `"Total OB ="` — defines Total Obligation as
`GrossLoanAmount × (1 + AddOnRate × Term)`, again with no penalty term. This is algebraically the
same formula independently used in `Monthly-Loan-ReleaseS.xlsx`'s own "Total OB" column,
reconciled exactly against 9 real released loans. Source: Legacy Analysis §3.3, §8.7.

### Legacy behavior

The legacy system uses **at least two distinct, internally consistent "total balance" concepts
simultaneously**, in active, current use (the Daily Collection Report examined is dated June
2026 — this is not a deprecated or historical artifact):

| Concept | Includes penalty? | Where used |
|---|---|---|
| Ledger running `balance` | Yes | Core transaction system of record |
| "Total Balance" (Daily Collection Report) | Yes | Day-to-day collections operations |
| "Total Obligation" (Accounting report) | No | Accounting/GL-style reporting |
| "Total OB" (origination-time quoting sheets) | No (penalty cannot exist yet at this point) | Loan origination and quotation |

**CONFIRMED FACT:** this is not a data error. The two formulas differ by a fixed, identifiable
term (penalty presence/absence) and each is internally self-consistent across multiple
independent documents. Source: Legacy Analysis §7.4.

### Accounting implications

**BUSINESS DECISION REQUIRED, not resolved by evidence:** a plausible explanation — offered as
interpretation, not fact, in the Legacy Analysis document (§7.4) — is that penalty income is
recognized on a different accounting basis than principal/interest/fees (e.g. cash-basis
recognition for a punitive/contingent charge, only booked as revenue when actually collected,
versus accrual recognition for the rest). This is a standard-enough accounting pattern that it is
*plausible*, but nothing in the evidence gathered confirms this is the actual reason, and
`PROJECT_RULES.md`'s "never invent business rules" principle applies here: this document does not
assert this is the reason, only that it is a reasonable hypothesis someone with accounting
authority should confirm or reject.

**CONFIRMED FACT, relevant to the accounting question specifically:** if penalty is excluded from
the accounting-facing balance because it is not yet "earned" revenue until collected, then a
penalty-exclusive figure is the more *conservative*, GAAP/PFRS-typical treatment for a contingent
charge — but this is stated as a general accounting principle, not as evidence about this
company's specific practice, and should not be read as this document silently deciding the
question.

### Collections implications

**CONFIRMED FACT:** the collections-facing documents (ledger `balance`, Daily Collection Report)
are penalty-inclusive — this makes operational sense independent of any accounting theory: a
collector needs to know the *total cash amount* a borrower must pay today, including any penalty
owed, not a GL-adjusted figure. If the new system's collections-facing UI/reports use a
penalty-exclusive balance, collectors would systematically under-quote borrowers relative to what
this company's own historical collections practice showed borrowers actually owed.

### Reporting implications

**CONFIRMED FACT:** `PROJECT_RULES.md §Reports` requires (among others) a "Delinquency Report,"
"Aging Report," and "Collection Report" — these are exactly the report types where a
penalty-inclusive total is the operationally meaningful figure, based on the legacy evidence
above (Daily Collection Report is precisely this kind of report, and is penalty-inclusive).
`PROJECT_RULES.md §Reports` also implies accounting-style reporting exists or will exist
(consistent with the legacy Accounting report's penalty-exclusive convention), but does not name
a specific accounting report requiring a penalty-exclusive figure — the new system's future
reporting requirements were not otherwise investigated in this evidence-gathering phase.

### Migration implications

**CONFIRMED FACT:** if the new system exposes only a single, penalty-inclusive
`outstandingBalance`, any migration of historical "Total Obligation"-style accounting figures
(if such a report is preserved or referenced post-migration) would need those figures computed
separately, not read off the new field. The reverse is equally true if only a penalty-exclusive
field is kept. **This is a direct consequence of the single-field option (Option, not Decision,
below), not a separate finding.**

### Advantages / Disadvantages of each design option

**Option 1 — Single, penalty-inclusive `outstandingBalance` field:**
- *Advantages:* simplest schema; matches the ledger's own native running total exactly (no
  derived/secondary calculation needed); matches the collections-operational use case, which
  (per `PROJECT_RULES.md §Payments`/`§Collections`) appears to be this platform's primary,
  named use case for balance figures.
- *Disadvantages:* loses the accounting-facing, penalty-exclusive view that at least one real,
  currently-used legacy report relies on; any future accounting report would need its own
  separate query/computation rather than reading a stored field.

**Option 2 — Single, penalty-exclusive `outstandingBalance` field:**
- *Advantages:* matches the accounting-report convention.
- *Disadvantages:* does **not** match the ledger's own native running total or the collections
  report — the majority of legacy evidence (2 of 3 confirmed sources) is penalty-inclusive; this
  option would require the new system's core domain balance to diverge from what the legacy
  ledger itself tracked as "the" balance, which is a larger behavioral change from legacy
  practice than Option 1.

**Option 3 — Two distinct, separately-named fields** (e.g. `collectionsBalance` /
`accountingBalance`, or similar):
- *Advantages:* faithfully represents both legitimate legacy concepts without forcing a choice
  that discards real, evidenced business information; supports both a Delinquency/Collection
  Report (per `PROJECT_RULES.md §Reports`) and a future accounting-style report without either
  needing a bespoke on-the-fly calculation; this was the Legacy Analysis document's own
  non-binding recommendation (§7.10).
- *Disadvantages:* more schema surface area (two fields instead of one, on every `LoanAccount`
  and likely wherever balance is presented); more complexity for every future balance-mutating
  use case, which must decide whether/how a given transaction affects each field (though this is
  mechanical — penalty transactions affect both, non-penalty transactions affect both identically
  — not a source of ambiguity, just extra fields to keep in sync).

### Risks

- **CONFIRMED FACT relevant to risk:** whichever option is chosen, `FINANCIAL_INVARIANTS.md §3`
  already requires that balances be reconstructible from transaction replay and updated only as a
  derived effect of a `LoanTransaction` insert within the same database transaction — this
  constraint applies identically to Option 1, 2, or 3, so it does not favor any option over
  another.
- **Risk specific to Option 1 or 2 (single field):** whichever concept is *not* chosen risks being
  silently unavailable when a future report or process needs it, discovered only when that gap
  becomes an incident, not during design.
- **Risk specific to Option 3 (two fields):** a real, if mechanical, risk of the two fields
  drifting out of sync if a future code change updates one but not the other — this is a
  standard "keep two derived values consistent" risk, mitigated by both being written atomically
  within the same transaction-scoped write path (already the architecture's existing pattern),
  not by anything special to this decision.

### Recommendation

Not made by this document, per your explicit instruction that this brief must not silently
decide unresolved business rules. The evidence weight, stated neutrally: **two of three
confirmed legacy sources (ledger `balance`, Daily Collection Report) are penalty-inclusive; one
confirmed source (Accounting report, corroborated by a second, origination-time source) is
penalty-exclusive.** If a recommendation is wanted from the assistant rather than left purely to
the evidence, ask explicitly — this section intentionally stops at presenting the tradeoffs.

### Confidence level

**CONFIRMED, at the highest confidence reached in this investigation, that both concepts are
real and currently, simultaneously in legacy use** — this is not in doubt. **UNRESOLVED, and not
resolvable by further legacy data mining**, is *why* the business treats them differently and
*which one (or both) the new system's canonical domain model should expose* — this is a
forward-looking design/business question, not a historical fact to be discovered.

---

## Decision 2 — How should the 79 non-reconciling `CLOSED` legacy loans be handled during migration?

### Background — what "non-reconciling" means here

**CONFIRMED FACT:** of 509 `CLOSED` loan accounts in the legacy database, 430 (84.5%) have all
four balance components (`principalBalance`, `interestBalance`, `feesBalance`, `penaltyBalance`)
equal to zero. The remaining 79 (15.5%) do not. Of the 142 accounts additionally flagged
`fullyPaid: true`, 34 (24%) still carry a nonzero `principalBalance`. Source: Legacy Analysis
§3.1.

**CONFIRMED FACT, full-population categorization (all 79, not a sample):**

| Category | Count | % of 79 | Status |
|---|---|---|---|
| Loan-to-loan `TRANSFER` present | 3 | 3.8% | Explained — confirmed benign |
| `IMPORT` marker(s) present | 15 | 19.0% | Plausible, not proven |
| `REPAYMENT_UNDO` present, unlinked | 18 | 22.8% | Plausible, not proven |
| Formal `WRITE_OFF` used | 0 | 0% | Ruled out as the cause |
| No special marker | 43 | 54.4% | Unresolved |

Source: Legacy Analysis §7.3.

**CONFIRMED FACT:** imbalance magnitudes range from ₱20.00 (`SL-LAZ_P4L2A`) to ₱692,813.97 (the
largest case in the original §3.1 aggregate check) — the small end is consistent with a
centavo-difference cleanup pattern the legacy system explicitly names in at least one transaction
comment (`"To close this account due to centavo difference."`, on a different, already-reconciled
loan); the large end is far too large to be a rounding artifact. Source: Legacy Analysis §7.3.2.

**CONFIRMED FACT:** legacy data corruption, deleted records, and rounding differences were
explicitly checked for and not found as a distinct, identifiable cause for this population as a
whole (rounding is plausible only for the smallest-magnitude subset; deleted records cannot be
proven or disproven from an export by definition; no orphaned/dangling references were found).
Source: Legacy Analysis §7.3.2.

**CONFIRMED FACT, relevant constraint:** `PROJECT_RULES.md §Data Migration` requires migration to
be "Repeatable," "Auditable," and "Idempotent," and states "Original legacy data must remain
unchanged." Every option below must satisfy this constraint — none of the four options proposes
modifying the legacy MongoDB source data itself; all operate only on what gets written into the
new PostgreSQL system during migration.

### Option A — Preserve legacy balances exactly

Migrate all 1,799 legacy loans, including the 79, with their `loan_accounts.bson` balance fields
copied verbatim into the new system's balance field(s) (whichever Decision 1 selects), regardless
of whether they reconcile against a transaction replay.

- **Advantages:** simplest migration logic; fully faithful to legacy system-of-record state;
  fully repeatable and idempotent (a pure copy); no risk of the migration process itself
  introducing a *new* discrepancy by attempting to "fix" something.
- **Disadvantages:** carries the 79 loans' unexplained discrepancies forward into the new system
  as-is, where `FINANCIAL_INVARIANTS.md §3`'s "balances must always be reconstructible from
  transaction history" invariant would be violated for these 79 loans from day one of the new
  system's life, for reasons no one currently understands for 54.4% of them.
- **Migration complexity:** **Low.** A straight field copy.
- **Financial risk:** **Low, if these are all genuinely closed/dormant loans** (as their
  `CLOSED` status implies) — no future write happens against them, so the incorrect-looking
  balance is inert data, not a live liability. **Elevated** if any of the 79 could plausibly be
  reopened or referenced in a future collections/write-off action, since the new system would
  then act on an unverified number.
- **Auditability:** **High** — the new system's record for these 79 loans exactly matches what
  the legacy system showed, which is itself directly auditable against the legacy export this
  investigation already produced.
- **Customer impact:** **None anticipated** — these are `CLOSED` accounts; no borrower-facing
  balance is being newly asserted.
- **Operational impact:** **Low** — no manual review required at migration time; defers any
  review indefinitely (a disadvantage as much as an advantage, depending on the business's risk
  tolerance for undocumented balances persisting).
- **Confidence level:** the trade-off itself is well-evidenced; whether it is an *acceptable*
  trade-off is a business risk tolerance question, not something evidence resolves.

### Option B — Recalculate balances from transactions

For every loan (or specifically the 79), discard the stored `loan_accounts.bson` balance fields
and instead compute the migrated balance by replaying that loan's full `loan_transactions.bson`
history through the new system's balance-tracking logic (§1 of the accompanying ADR-007).

- **Advantages:** produces a balance guaranteed to satisfy `FINANCIAL_INVARIANTS.md §3`'s
  reconstructibility invariant from the moment of migration; for the 430 already-reconciling
  loans this produces an identical result to Option A (no downside there); for the 79, this would
  *resolve* the discrepancy by definition — the new system's number would always equal what
  replay produces.
- **Disadvantages, significant:** **CONFIRMED FACT, directly relevant and disqualifying for a
  pure/unconditional version of this option:** the component-field semantics inconsistency found
  in this investigation (`principal_amount`/`interest_amount`/`fees_amount`/`penalty_amount`
  populated inconsistently — sometimes a true delta, sometimes a balance-snapshot value, across
  different loans, for the same transaction type — Legacy Analysis §7.5) means a **naive**
  component-summing replay is **not a reliable reconstruction method** and could silently produce
  a *third*, novel, incorrect number for some unknown subset of loans — worse than either the
  legacy figure or a resolved figure. **A safe version of this option must replay using the
  ledger's own `balance` field's incremental deltas (already confirmed reliable, ADR-007 §1),
  not by re-summing the component fields.** Even using the reliable method, this option
  *silently overrides* the legacy system's own recorded final state for the 79 loans, which
  conflicts with `PROJECT_RULES.md`'s "verified production data" being priority-1 evidence — the
  legacy `balance` field itself *is* verified production data, and this option would discard it
  in favor of a recomputation, which needs justification beyond "it's more internally
  consistent."
- **Migration complexity:** **Higher** — requires replaying 524,463 transactions (or the relevant
  subset) through new-system logic during migration, not a simple field copy; requires the
  calculation engine's balance-tracking logic to exist and be trustworthy *before* migration can
  run, creating a sequencing dependency Option A doesn't have.
- **Financial risk:** **Moderate** — if the replay logic itself has a bug (untested against a
  real live Postgres, per the project's standing "no live Postgres ever used" gap), the
  recalculated number could be wrong in a way that's harder to detect than Option A's "obviously
  copied from legacy" number, precisely because it looks self-consistent.
- **Auditability:** **Moderate** — the new number is auditable against the replay logic and the
  transaction history, but no longer directly matches what the legacy system itself displayed to
  users historically, which could confuse anyone cross-referencing old legacy reports against the
  new system post-migration.
- **Customer impact:** **None anticipated** for `CLOSED` accounts, same reasoning as Option A.
- **Operational impact:** **Higher** — requires building and testing replay logic specifically
  for migration purposes (not just for live calculation-engine use), and deciding what to do when
  replay produces a number that differs from the legacy stored figure (silently accept it? flag
  for review? — this itself becomes a sub-decision).
- **Confidence level:** the *reliability caveat* (must use `balance`-delta replay, not
  component-summing) is **CONFIRMED** and non-negotiable if this option is chosen. Whether
  recalculation is the *right* choice at all remains a business decision.

### Option C — Hybrid migration

Migrate all loans' legacy balances as-is (Option A), **except** apply the categorization already
performed (§7.3 of the Legacy Analysis document) to the 79: migrate the 3 `TRANSFER`-explained
loans and any other confirmed-benign cases with their legacy figures unmodified (they're already
understood, not actually wrong), and flag the remaining, still-unexplained loans (up to 76,
depending on how much weight is given to the "plausible, not proven" `IMPORT`/`REPAYMENT_UNDO`
correlations) for a distinct migration-time treatment — e.g. a dedicated `migrationNote`/`
requiresReview` flag on the migrated record, rather than either silently trusting or silently
overriding the number.

- **Advantages:** does not treat all 79 as a monolithic, equally-uncertain group when the
  evidence itself distinguishes confidence levels within it (3.8% explained, 41.8% plausibly
  explained, 54.4% genuinely unresolved) — this is the option most directly aligned with
  `PROJECT_RULES.md`'s instruction to "clearly distinguish confirmed, partially confirmed,
  assumed, unknown" rather than collapsing them into one migration rule. Preserves legacy data
  unmodified (satisfying `PROJECT_RULES.md §Data Migration`) while still surfacing the
  uncertainty for human review, rather than either hiding it (Option A) or silently resolving it
  algorithmically (Option B).
- **Disadvantages:** most complex of the three to implement — requires the migration script to
  carry per-loan categorization metadata, not just balance figures; requires a design decision on
  what a `requiresReview`-flagged loan means operationally in the new system (does it block any
  action? is it purely informational?) — not resolved by this brief.
- **Migration complexity:** **Moderate-to-high** — more than Option A, likely comparable to or
  less than Option B (no replay logic needed, just categorization tagging, which is simpler than
  building trustworthy replay logic).
- **Financial risk:** **Low** — same reasoning as Option A for the underlying figures (nothing is
  recalculated), with the added benefit that the genuinely uncertain subset is now visible rather
  than silently indistinguishable from the confirmed-good 84.5%.
- **Auditability:** **Highest of the three options** — every migrated loan's confidence level is
  explicit and traceable directly back to this investigation's categorization, not just to the
  raw legacy export.
- **Customer impact:** **None anticipated**, same reasoning as Option A/B.
- **Operational impact:** **Moderate** — creates a defined (if small, ≤76 loans) manual-review
  queue at or shortly after migration, rather than deferring indefinitely (Option A) or resolving
  silently (Option B).
- **Confidence level:** the categorization this option would rely on is itself evidence-graded
  per §7.3 (not uniformly confident) — this option's own internal risk is proportional to how
  much weight is placed on the "plausible, not proven" 41.8%, which this brief does not resolve
  further.

### Option D — Obtain institutional clarification before finalizing migration treatment

Not a migration *mechanism* like A/B/C, but a **prerequisite step**: before committing to any of
the above, ask someone with institutional knowledge of the legacy system's operations to review
the 54.4% "no special marker" category (and, time permitting, the `IMPORT`/`REPAYMENT_UNDO`
correlated categories) directly. This was already the Legacy Analysis document's standing
recommendation (§7.3.1, §7.10), reiterated here because it materially changes which of A/B/C is
appropriate.

- **Advantages:** has the highest potential to convert "plausible, not proven" and "unresolved"
  categorizations into either genuine `CONFIRMED` explanations (enabling a more precise version
  of Option C, or even ruling in favor of Option B for a now-understood subset) or a firm "that's
  expected, migrate as-is" answer (supporting Option A with actual confidence rather than
  default caution) — likely resolvable "in minutes," per the Legacy Analysis document's own
  assessment, versus the many hours already spent on data-mining alone.
  **Advantages over the previous milestone attempt:** if the domain expert also has visibility into any Excel workbook maintained around 2010-2019, or manual "closing procedure" notes for the older, no-marker loans, that could resolve the 43-loan (54.4%) group specifically.
- **Disadvantages:** depends on availability of someone with this institutional knowledge, and on
  their memory/documentation being accurate for events that, for some of these loans, are over a
  decade old (the oldest disbursement dates among the 26-loan `DECLINING_BALANCE_DISCOUNTED`
  "neither pattern" group, a related but distinct finding, go back to 2010).
- **Migration complexity:** **N/A** — this is a pre-migration step, not a migration mechanism.
- **Financial risk:** **N/A directly**, but reduces the residual risk of whichever of A/B/C is
  ultimately chosen.
- **Auditability:** improves whichever option follows it, by attaching a human-sourced
  explanation to the migration record instead of only an automated categorization.
- **Customer impact / Operational impact:** minimal — a research/inquiry step, not a system
  change.
- **Confidence level:** this option's *value* is well-evidenced (the categorization work already
  narrowed exactly what questions to ask); whether it's *pursued* is a scheduling/resourcing
  decision, not something this brief can make for you.

### Recommendation

Not made by this document, per instruction. Presented neutrally: **Option C, optionally preceded
by Option D, is the option that most directly reflects the evidence's own confidence gradations**
(rather than treating all 79 as uniformly acceptable or uniformly suspect) and is the only option
that satisfies both `PROJECT_RULES.md §Data Migration`'s "preserve original legacy data" and
"auditable" requirements simultaneously with full transparency about what is and isn't understood.
Option B's disqualifying caveat (component-summing unreliability) is a **CONFIRMED FACT**, not a
recommendation — any version of Option B that doesn't use `balance`-delta replay specifically
should be considered ruled out by evidence, not merely discouraged.

### Confidence level

**CONFIRMED:** the categorization (§7.3 table above) and the disqualifying caveat on naive
component-summing replay (Option B). **UNRESOLVED, and explicitly a business decision, not a
data question:** which migration strategy to adopt, and what risk tolerance the business has for
carrying forward ₱-value uncertainty on a small, closed, historically-inert loan population.

---

## Additional Decisions Required Before Implementation

Discovered while preparing this brief, from `CALCULATION_ENGINE_SPEC.md`'s own explicit
`STATUS: UNRESOLVED` sections — included here only because each genuinely blocks a piece of
calculation-engine implementation, not because this brief is expanding its own scope beyond
Decision 1/2:

1. **Flat-Rate interest formula (`CALCULATION_ENGINE_SPEC.md` §4).** No legacy evidence — no
   worked example, no formula cell in the `Sample Computation Sheet` workbook (built entirely
   around declining-balance calculations), no report — was found for how `FLAT`-method loans'
   interest is computed. **This blocks onboarding or servicing any `FLAT`-method loan in the new
   system** until evidence is found or institutional clarification is obtained. Not urgent for
   Milestone 9.1 *unless* Flat-Rate products are part of its initial scope — a scheduling
   question for you, not a data question for this brief.

2. **Overpayment recording mechanism (`CALCULATION_ENGINE_SPEC.md` §11).** Two full-population
   searches (524,463 transactions) found zero legacy examples of an overpayment being recorded.
   `PROJECT_RULES.md §Payments` requires the new system to support overpayments as a valid state
   regardless — this blocks a *complete* implementation of `PaymentAllocationService`'s
   remainder-handling path (per ADR-009 §5's "Edge Cases"), though a version handling only
   exact-and-under payments could proceed without it, deferring overpayment support to a
   follow-up checkpoint if acceptable.

3. **Penalty calculation formula (`CALCULATION_ENGINE_SPEC.md` §12).** The daily `PENALTY_APPLIED`
   cadence is confirmed as a legacy pattern (79.3% of all legacy transactions), and
   `penalty_calculation_method: "PERCENTAGE_PER_DAY"` / `penalty_rate` fields are observed on
   real accounts, but no formula connecting them to actual posted penalty amounts was verified.
   This is additionally gated by ADR-008 (penalty cap policy), which remains open and was not
   produced this milestone. **This blocks any penalty-bearing loan's balance from being fully,
   correctly serviced** — relevant to Decision 1 above, since a system that cannot yet compute
   new penalty amounts correctly has a narrower practical need for a penalty-inclusive balance
   field in the immediate term, though the *field design* decision should still be made based on
   the evidence in Decision 1, not deferred merely because the *calculation* is not yet ready.

None of these three are new discoveries — each was already flagged in `CALCULATION_ENGINE_SPEC.md`
at the time it was written. They are restated here only because, in the course of preparing this
brief, it became clear that Decision 1 and Decision 2 (both about *balance*) are naturally
coupled to Decision 3's penalty-formula gap specifically, and surfacing that coupling explicitly
serves this document's purpose of letting you decide with full context.

---

## Summary table

| Decision | Status | What's needed |
|---|---|---|
| 1. Does `outstandingBalance` include penalty? | Evidence complete; 3 design options presented, none selected | Your decision |
| 2. How to migrate the 79 non-reconciling `CLOSED` loans? | Evidence complete; 4 options (A/B/C/D) presented, none selected | Your decision |
| 3. Flat-Rate interest formula | No evidence found | Institutional input or further evidence |
| 4. Overpayment recording mechanism | No evidence found | Institutional input, or defer to a later checkpoint |
| 5. Penalty calculation formula | Partial evidence (pattern observed, formula not verified); also gated by open ADR-008 | Institutional input or further evidence |

This document does not update `docs/PROJECT_HANDOFF.md`, does not amend `ADR-007-outstanding-
balance-formula.md`, and does not begin Milestone 9.1 implementation, per your explicit
instruction.
