# ADR-045 — Repayment Schedule Due-Date Generation

**Status:** UNRESOLVED — a business decision is required before this ADR can be marked Accepted.
Blocks the `RepaymentInstallment` schedule-generation portion of Milestone 9.1 Checkpoint 8
(`ActivateLoanUseCase`); does not block CP8's activation/ledger/audit portions (see §5).
**Context documents:** `docs/Architecture/MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md` (CP8);
`docs/Architecture/CALCULATION_ENGINE_SPEC.md` §2 (Level Payment Amortization — confirms the
schedule-generation formula's output has no date field); `docs/Legacy Analysis/2026-07-03-
milestone9-financial-rules-verification.md` §1.1 (evidence-source inventory); this session's
full-population empirical check of `legacy/mongodb/07012026_103239/db-easycash/disbursements.bson`
(6,508 records).

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

## 4. Decision required (not made by this ADR)

This ADR does not select an answer — that is a business decision, not an engineering one. Options
for a human decision, listed without preference:

- **(A) Capture an explicit input at origination/approval time** — e.g., a "first repayment date"
  or "preferred payment day" field collected from the borrower or loan officer, added to
  `LoanAccount` (or a prior step). Matches the observed payday-linked clustering without inventing
  a fixed rule the data doesn't support.
- **(B) Adopt a fixed, product-configured offset for the new system going forward** — e.g., a new
  `LoanProductVersion.firstInstallmentOffsetDays` (or similar) config field, chosen deliberately as
  a *new* policy, with the explicit, documented acknowledgment that it will not match roughly 80%
  of legacy loans' actual historical pattern.
- **(C) Some other convention not yet considered**, to be proposed and evidenced separately.

---

## 5. Disposition for Milestone 9.1 Checkpoint 8

Per `docs/Architecture/ADR-032-loan-release-vs-disbursement.md` §5, `ActivateLoanUseCase`
represents one business event that may still perform several internal writes. This ADR blocks
only the specific internal write that requires a due date: generating and persisting
`RepaymentInstallment` schedule rows. It does **not** block CP8's other internal writes — the
`APPROVED → ACTIVE` status transition (`LoanAccount.activate()`, already built in CP7), the
`DISBURSEMENT`-typed `LoanTransaction` insert, and the financial audit log entry — none of which
require a due date.

No change to `MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`'s checkpoint numbering is introduced by
this ADR. CP8 remains a single checkpoint; this ADR is recorded there as its business blocker for
the schedule-generation portion of its scope, the same way `ADR-007` §3/§4 are already recorded as
blockers for CP11/CP12 without being modeled as separate checkpoints.
