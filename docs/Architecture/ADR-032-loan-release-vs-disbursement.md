# ADR-032 — Loan Release vs. Disbursement Lifecycle

**Status:** Accepted (Milestone 9 design review, 2026-07-03)
**Context documents:** `docs/Legacy Analysis/2026-07-03-milestone9-financial-rules-verification.md`
§3.4, §7.9, §8.9 (evidence); `docs/Architecture/FINANCIAL_INVARIANTS.md` §8 (prior open-item
listing); `prisma/schema.prisma` (`LoanAccount.activatedAt`, `LoanTransactionType.DISBURSEMENT`).
**Supersedes:** the "working assumption only" status this question previously carried in
`FINANCIAL_INVARIANTS.md §8` and `docs/PROJECT_HANDOFF.md`.

---

## 1. Decision

**"Loan Release" and "Disbursement" are one business event, not two.** The new system's existing
structural design — `LoanAccount.activatedAt` set at the same moment a single `DISBURSEMENT`-typed
`LoanTransaction` is recorded — is **confirmed, not merely assumed**, and is formally accepted as
the model for the future `ActivateLoanUseCase` (disbursement/activation) once the calculation
engine exists to support it.

No new schema field, no new `LoanAccountStatus` value, and no separate "release" transaction type
are introduced by this ADR.

---

## 2. Evidence

Four independent legacy sources were examined for a distinct "release" concept, separate from
disbursement. None found one:

1. **`loan_accounts.bson`** (MongoDB, 1,799 documents) has exactly two lifecycle timestamps
   leading up to a loan being active: `approvedDate`, and the disbursement event itself
   (`activationTransactionKey` / `disbursementDetailsKey`). No third, `releasedDate`-shaped field
   exists on any record examined.
2. **`disbursements.bson`** (MongoDB collection, sampled) — fields are
   `expected_disbursement_date`, `disbursment_date` [sic, legacy typo], `first_repayment_date`.
   No "release" field or concept.
3. **`legacy/reports/Loan Accounts Details.xlsx`** (1,779 rows) has a single `Activation Date`
   column — not separate `Release Date` and `Disbursement Date` columns.
4. **`legacy/reports/Monthly-Loan-ReleaseS.xlsx`** — despite being *titled* "Loan Release**s**",
   its own date column header is `Disbursement Date`. The legacy system's own reporting
   vocabulary uses "Release" and "Disbursement" as synonyms for the same event.
5. **`201 Loan Docs LA Template.docx` and `PN Template.docx`** (the actual Loan Agreement and
   Promissory Note legal document templates) both use a single merge field —
   `{{DisbursementDate}}` — as the operative date for loan execution. No `{{ReleaseDate}}` or
   equivalent field exists in any of the nine legal document templates examined.
6. **`closed_accounts.bson`**, which might plausibly have held a distinct closure/release-adjacent
   data model, is **empty** (0 documents) in this export. It provides no evidence either way, but
   its emptiness was checked and is not concealing a second event.

Five independent sources (account records, the disbursement collection, an Excel report's column
header, a second Excel report's own title-vs-column-header mismatch, and the borrower-facing
legal documents themselves) converge on one vocabulary: **disbursement**. Zero sources reference a
distinct "release" event.

---

## 3. Confidence and its limits

This is recorded as **PARTIALLY CONFIRMED → ACCEPTED**, not **CONFIRMED**, for one honest reason:
absence of evidence for a second event across five sources is very strong, but not logically
airtight — it remains conceivable that a "release" step existed under a name not searched for, or
in a source not examined (see `docs/Legacy Analysis/...` §1.1 for the full inventory of what was
and wasn't examined). This ADR accepts the practical conclusion because:

- `PROJECT_RULES.md`'s priority order places verified production data and legal documents above
  legacy behavior generally, and this finding is corroborated by the **legal documents** the
  borrower actually signs (the highest-authority evidence type available in this investigation) —
  not merely by internal legacy fields that could themselves be idiosyncratic.
- No cost is paid by deciding this now: the schema's `LoanAccount.activatedAt` +
  `DISBURSEMENT`-typed `LoanTransaction` design was already built this way in Milestone 7, on the
  same working assumption. This ADR changes nothing structurally; it only removes the "working
  assumption only" caveat and replaces it with cited evidence.
- If evidence for a genuine second event later surfaces (e.g. from institutional knowledge, per
  the Legacy Analysis document's recommendation to ask directly), this ADR can be revised without
  requiring a schema migration to correct course, per §5 below.

---

## 4. What this decision does NOT resolve

- **Loan approval remains a separate, prior event from disbursement/activation** (`LoanAccount.
  approvedAt` vs. `activatedAt`) — this ADR does not merge those two. `ApproveLoanUseCase` (built
  in Milestone 7/8) and the future `ActivateLoanUseCase` remain two distinct use cases, consistent
  with `LoanAccount.ts`'s existing `ALLOWED_TRANSITIONS` table (`PENDING_APPROVAL → APPROVED →
  ACTIVE`).
- **This ADR does not itself define what `ActivateLoanUseCase` does** (schedule generation, fee
  application, the exact multi-aggregate transaction it must wrap in `IUnitOfWork`) — that is
  Milestone 9.1 implementation work, gated on the calculation engine (ADR-007/009/010) and the
  Financial Audit Isolation / Optimistic Concurrency ADRs also produced this milestone.
- **Whether a "renewal" or "restructuring" event should be modeled as its own lifecycle step**
  is out of scope — no evidence was gathered on this question, and `PROJECT_RULES.md`'s renewal/
  restructuring requirements remain a future milestone's concern.

---

## 5. Implementation notes for the future `ActivateLoanUseCase`

- A loan transitions `APPROVED → ACTIVE` via exactly one use case invocation, which — per this
  ADR — represents a single business event to the borrower (they sign one Loan Agreement and one
  Promissory Note dated to the same disbursement date, per §2 evidence item 5).
- That one use case invocation may still perform multiple internal writes atomically (via
  `IUnitOfWork`, per `docs/Architecture/ADR-042-aggregate-boundaries.md` §9) — e.g. updating
  `LoanAccount.status`/`activatedAt`, inserting a `DISBURSEMENT`-typed `LoanTransaction`, and
  generating the initial `RepaymentInstallment` schedule. This ADR concerns the **business-event**
  granularity (one event), not the **transaction-boundary** granularity (which may span several
  writes) — these are deliberately different concepts per ADR-042 §10.
- No `LoanAccountStatus` enum change is required by this ADR; the existing
  `PENDING_APPROVAL → APPROVED → ACTIVE → ...` lifecycle already models this correctly.

---

## 6. Relationship to other open ADRs

This ADR is a prerequisite for the future `ActivateLoanUseCase`'s design, referenced in
`docs/Architecture/FINANCIAL_INVARIANTS.md §8` as one of the four originally-open ADRs blocking
calculation-engine work. With this ADR accepted, `ActivateLoanUseCase`'s shape can be scoped
without ambiguity about whether it represents one or two borrower-facing events — the remaining
blockers for that use case are ADR-007 (balance formula, still open) and ADR-009 (payment
allocation order, addressed in a companion ADR).
