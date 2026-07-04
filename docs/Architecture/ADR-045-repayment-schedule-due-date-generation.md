# ADR-045 — Repayment Schedule Due-Date Generation

**Status:** ACCEPTED — **Concept 1: Exact First Repayment Date**. Unblocks the `RepaymentInstallment`
schedule-generation portion of Milestone 9.1 Checkpoint 8 (`ActivateLoanUseCase`); see §6.
**Context documents:** `docs/Architecture/MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md` (CP8);
`docs/Architecture/CALCULATION_ENGINE_SPEC.md` §2 (Level Payment Amortization — confirms the
schedule-generation formula's output has no date field); `docs/Legacy Analysis/2026-07-03-
milestone9-financial-rules-verification.md` §1.1 (evidence-source inventory); this session's
full-population empirical check of `legacy/mongodb/07012026_103239/db-easycash/disbursements.bson`
(6,508 records); `docs/Architecture/ADR-044-separate-customer-identity-for-public-portal.md`
(future Public Portal compatibility, referenced in §6).

---

## 1. The gap

`RepaymentInstallment.dueDate` is a required, non-nullable field (`app/backend/prisma/schema.prisma`,
unchanged since Milestone 4). No ADR, `CALCULATION_ENGINE_SPEC.md`, the Legacy Analysis document,
the Prisma schema, migrations, seed data, or any test fixture defines a formula for deriving it
from disbursement date, grace period, or any other value already available to the system.

`CALCULATION_ENGINE_SPEC.md` §2 (Level Payment Amortization, `STATUS: CONFIRMED`) is the only
confirmed schedule-generation formula in this codebase. Its own documented `Outputs` are
`{ period: number; interestPortion: Money; principalPortion: Money; remainingBalance: Money }` —
no date of any kind. `AmortizationScheduleGenerator` (CP3, already built) matches this exactly.

---

## 2. What was searched

A repository-wide investigation covered: every ADR under `docs/Architecture/`,
`CALCULATION_ENGINE_SPEC.md` in full, `FINANCIAL_INVARIANTS.md` in full, the Legacy Analysis
document (full section-header index reviewed, plus targeted search), `app/backend/prisma/schema.prisma`
and every migration, `app/backend/src/` (all files referencing `dueDate`/`gracePeriod`/related
terms), `app/backend/tests/`, `app/backend/prisma/seed.ts`, repo-wide `TODO`/`FIXME` comments,
`legacy/sdevtech/` (confirmed empty — 0 files), and the empty top-level `docs/Reports/`,
`docs/SRS/`, `backend/`, `frontend/`, `database/`, `deployments/`, `scripts/`, `tests/` scaffold
directories. None contain a due-date generation rule.

The raw legacy MongoDB export was also examined directly, beyond what the original Milestone 9
Legacy Analysis document covered for this specific question:

- `payment_schedules.bson` — confirmed empty (0 bytes), per the Legacy Analysis document's own
  §1.1 evidence-source table, independently reconfirmed this session.
- `repayments.bson` (~20,000+ documents streamed) — has a `due_date` field per installment,
  previously examined only to verify payment *ordering* (`ADR-009` §2), never for a *generation
  formula*.
- `disbursements.bson` — read in full (6,508 documents, not sampled). Each document carries both
  `disbursment_date` and `first_repayment_date`, making a direct, population-wide comparison
  possible without needing to join across collections.

---

## 3. What the evidence shows

Across the 6,004 `disbursements.bson` records with both dates populated (full population, not a
sample):

- **169 distinct day-gaps** were observed between `disbursment_date` and `first_repayment_date`.
  The single most common gap (31 days) covers **1,238 records — 20.6%** of the population. No
  gap value covers a majority, or anything close to one.
- The **"same calendar day, next month"** convention — the most structurally obvious candidate,
  since `LoanProductVersion.repaymentPeriodUnit` is always `MONTHS` — matches only **2,195 of
  6,004 records (36.6%)**.
- Day-gaps range continuously from 1 day to 71+ days, with no secondary cluster indicating a
  two-branch rule (e.g., "30 days, except when X").
- The day-of-month distribution of `first_repayment_date` shows soft clustering around several
  common dates (3rd, 5th, 10th, 15th, 25th, 30th — each roughly 9–14% of records), but no single
  day accounts for a majority, and no field capturing a per-borrower "preferred payment day" or
  similar concept exists anywhere in the current schema or domain model.

**What this evidence supports, precisely:**
- No deterministic rule relating `first_repayment_date` to disbursement date, grace period, or
  any other already-known field is present in the data — every candidate formula tested against
  the full population fails to cover more than roughly a fifth to a third of real records.
- The legacy data actively disproves the two most structurally obvious candidate formulas (fixed
  month-offset, fixed calendar day), rather than merely lacking evidence for them.
- The current repository — schema, domain model, and all documentation — does not contain enough
  information to derive a due date safely for a newly activated loan. Whatever determined
  `first_repayment_date` in the legacy system is not reconstructible from data available to this
  investigation.

**What this evidence does NOT support**, and is therefore not claimed: no record, log, or
document examined states or implies *how* `first_repayment_date` was originally set (a UI form
field, an operator override, a partially-applied system default later edited, or something else).
That mechanism is unknown, not merely undocumented — the investigation supports only that no
*rule* is recoverable from what the legacy data and current repository contain, not any specific
account of *why*.

---

## 4. Options considered (record of the decision analysis)

Four concepts were analyzed in full against business usability, operational workflow, restructuring
impact, renewals, future Public Portal compatibility, implementation complexity, maintenance cost,
long-term extensibility, and legacy-migration implications, before a decision was made:

- **Concept 1 — Exact first repayment date**, captured explicitly at origination. *(Selected —
  see §5.)*
- **Concept 2 — Preferred repayment day-of-month.** Rejected: mathematically incapable of
  reproducing the observed day-gaps beyond ~31 days (gaps up to 71+ days were recorded in the full
  population), so it cannot represent a meaningful share of real historical loans even
  approximately, independent of any UX consideration.
- **Concept 3 — Preferred payday / repayment cycle.** Rejected: requires new borrower pay-frequency
  data that does not exist anywhere in the current schema or the examined legacy exports (confirmed
  directly against `BorrowerIncomeDetail`'s actual fields — `employmentType`, `employerName`,
  `employerAddress`, `natureOfBusiness`, `position`, `yearsEmployed`; no pay-cycle field among
  them), and shares Concept 2's mathematical incompatibility with the observed gap range.
- **Concept 4 — Product-level default with a per-loan override (hybrid).** Rejected: the
  "default" half of this concept was shown to fit the population no better than Concept 2 did (the
  same >31-day gaps defeat it), so it adds a second data path and a precedence rule for a default
  whose own justifying evidence doesn't hold up — the same category of premature-abstraction cost
  this roadmap's Decision Log already rejected twice elsewhere (`LoanActivationPolicy`,
  `PaymentAllocationOrder`).

---

## 5. Decision

**Concept 1 — Exact First Repayment Date is the accepted design.** `LoanAccount` will store an
explicit `firstRepaymentDate`, supplied as an input at loan origination (alongside the loan's other
already-captured origination fields, e.g. `gracePeriodDays`), and used directly as the schedule's
anchor date when `ActivateLoanUseCase` (CP8) generates the `RepaymentInstallment` rows.
Subsequent installments are spaced from that anchor by the loan's already-confirmed
`repaymentPeriodUnit` (`MONTHS` — the only value the schema currently supports).

**Rationale, based only on repository evidence and the legacy investigation (§1–§3 above), not on
general lending convention:**

- It is the only concept with **zero contradiction against the evidence**. The full-population
  check of 6,004 `disbursements.bson` records found day-gaps ranging continuously from 1 to 71+
  days across 169 distinct values — a range only an explicitly-captured, unconstrained date can
  represent. Concepts 2 and 3 are not merely less-evidenced; they are mathematically incapable of
  producing gaps beyond roughly a month, which the real population clearly contains.
- It **fully resolves the legacy-migration question** for any future import of historical loans
  (the separate CP12 migration track, gated on `ADR-007` §4): `disbursements.bson`'s
  `first_repayment_date` maps onto this field directly, with no transformation and no formula to
  validate against 6,004 historical records.
- It requires **no new data model** beyond one field on `LoanAccount` — no new `Borrower`/
  `BorrowerIncomeDetail` fields, no new enum, no cross-entity precedence logic.
- It is the best fit for the future Public Portal (`ADR-044`): a self-service applicant flow can
  ask for this date directly, consistent with `ADR-044`'s principle that customer-facing intake
  should be additive rather than requiring rework of existing structures.
- It matches this project's own repeatedly-applied engineering discipline, verified directly
  against `MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`'s Decision Log: `LoanActivationPolicy` and
  `PaymentAllocationOrder` were both rejected as premature abstractions built ahead of a
  demonstrated need, per `CLAUDE.md`'s "don't design for hypothetical future requirements."
  Concept 4's product-default mechanism would have repeated that same pattern, for a default whose
  own fit against the evidence doesn't hold up any better than Concept 2's did.

**What this decision does NOT resolve:** the exact validation bounds for a supplied
`firstRepaymentDate` (e.g., how far in the future it may reasonably be) are not specified here —
that is a schema/use-case implementation detail for CP8, not a business decision this ADR needs to
settle. Restructuring's future due-date behavior (`ADR-041`, still out of scope per
`FINANCIAL_INVARIANTS.md` §1) is unaffected by this decision — any future restructuring event
supplies its own fresh anchor date at that time, the same way this one is supplied at origination.

---

## 6. Disposition for Milestone 9.1 Checkpoint 8

Per `docs/Architecture/ADR-032-loan-release-vs-disbursement.md` §5, `ActivateLoanUseCase`
represents one business event that may still perform several internal writes. This ADR previously
blocked only the specific internal write that requires a due date: generating and persisting
`RepaymentInstallment` schedule rows. **That block is now lifted** — CP8's schedule-generation
portion may proceed using `LoanAccount.firstRepaymentDate` as the anchor, alongside CP8's other
internal writes (the `APPROVED → ACTIVE` status transition via `LoanAccount.activate()`, already
built in CP7; the `DISBURSEMENT`-typed `LoanTransaction` insert; and the financial audit log
entry), all inside one `IUnitOfWork.run()` call as already planned.

No change to `MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`'s checkpoint numbering results from this
ADR. CP8 remains a single checkpoint, now fully unblocked.
