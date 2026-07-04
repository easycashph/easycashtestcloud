# Financial Invariants

**Status:** Living document. Update whenever a financial rule is verified, changed, or a
pending ADR below is resolved — per `CLAUDE.md`'s Decision Log requirement and
`PROJECT_RULES.md`'s priority order (verified production data > official policy > approved
management decisions > legacy behavior > explicitly marked assumptions).

**Purpose:** capture the non-negotiable financial rules that every future milestone —
particularly the interest/amortization calculation engine and payment-processing work that
follows Milestone 7 — must preserve. These rules are binding on implementation; a design that
violates one of them is a defect, not a trade-off, unless this document is explicitly amended
first with the reasoning for the change (per the Decision Log requirement).

Rule IDs (`LA-*`, `TXN-*`, `REPAY-*`, `FEE-*`, `PEN-*`, `LPV-*`, `FIN-*`) match the citations
already present as `///` doc comments in `app/backend/prisma/schema.prisma`, so schema, code,
and this document stay traceable to the same source of truth.

---

## 1. Immutability & Append-Only Rules

- **TXN-1 — The ledger is append-only.** No code path may `UPDATE` or `DELETE` a
  `LoanTransaction` row after creation. Corrections are new, explicitly linked reversal
  transactions (`reversesTransactionId`), never edits. The `ILoanTransactionRepository` port
  must not expose an `update()` or `delete()` method at all — this is enforced at the type
  level, not just by convention.
- **LPV-1 / LPV-3 — A `LoanProductVersion` is an immutable snapshot once referenced by an
  approved `LoanAccount`.** Editing a `LoanProduct` or creating a new version must never alter
  the financial rules already in effect for an existing loan. Historical loans always calculate
  using the exact version they were approved under.
- **FEE-4 — An `AppliedFee` amount is immutable once applied.** Later edits to the originating
  `FeeRule` must not retroactively change fees already charged to a loan.
- **`RepaymentInstallment.*Due` fields are immutable after schedule generation**, except through
  a formal restructuring event (ADR-041, currently out of scope). Only `*Paid` fields and
  derived `status` change during the life of an installment. This is what allows
  `RepaymentInstallment` to be modeled as its own small aggregate (see
  `docs/Architecture/ADR-042-aggregate-boundaries.md` §7 — formally written) — the
  one cross-row invariant below is guaranteed at batch-creation time and never needs runtime
  re-verification.
- **AUDIT-1 / AUDIT-2 — `AuditLog` is append-only.** No update/delete path is ever exposed.

## 2. Single Active Version Rule

- **LPV-2 (Hard Rule) — At most one `LoanProductVersion` per `LoanProduct` may have
  `isActive = true` at any time.** Enforced at two independent layers:
  1. Application layer: `activateVersion(productId, versionId)` on the `LoanProduct` aggregate
     is the *only* sanctioned path to flip `isActive`; it deactivates the current active version
     and activates the new one as one operation.
  2. Database layer: a PostgreSQL partial unique index
     (`prisma/migrations/20260702010000_schema_review_indexes_and_lpv2_guard`) as a backstop —
     application logic must never rely on this catching a bug instead of preventing one.

## 3. Balance Integrity

- **No code path may write to a `LoanAccount` balance field
  (`principalBalance`/`principalPaid`/`principalDue`, and the equivalent interest/fees/penalty
  triads) except as a derived effect of a `LoanTransaction` insert, within the same database
  transaction.** There is no "manual balance adjustment" endpoint that bypasses the ledger — an
  adjustment is itself a typed `LoanTransactionType.ADJUSTMENT` entry.
- **A `LoanAccount`'s balances must always be reconstructible from its `LoanTransaction`
  history.** The stored balance fields are a performance/query-convenience cache of a value that
  is, in principle, derivable by replaying transactions — they must never diverge from what that
  replay would produce. (ADR-007, outstanding-balance formula, is still open — this rule
  constrains *how* balances may be written, independent of the still-undecided formula itself.)
- **Overpayments, advance payments, and reversals are valid states, not error conditions**
  (`PROJECT_RULES.md §Payments`). "Balance went negative" is not inherently invalid — only
  specific, named business rules (to be defined when the calculation engine is built) may
  reject a transaction; the `Money` value object itself must never encode "negative is illegal"
  as a type-level constraint.

## 4. Audit Requirements for Financial State Changes

- **Financial writes fail closed; authentication writes fail open — deliberately different, per
  module.** `identity`'s `IAuditLogger.log()` is explicitly non-throwing (M6 finding H-04): a
  transient audit-infrastructure failure must never lock out a legitimate user. This reasoning
  **does not extend** to `loan-account`/`ledger`/`repayment`: an unaudited financial state
  change is a worse outcome than a failed write. Financial-write audit entries must be committed
  in the **same database transaction** (via `IUnitOfWork`) as the financial state change itself
  — if the audit write fails, the whole transaction (including the balance/ledger change) rolls
  back.
- This distinction should be formalized as its own ADR ("Audit Logging Failure Isolation — Auth
  vs. Financial") before the first multi-aggregate financial use case is implemented — tracked
  as an open item below.

## 5. Money & Rounding

- **All monetary values are represented as `Decimal(14,2)`; all rates/percentages as
  `Decimal(6,3)`.** Native JS `number` must never hold a monetary value at any point in the
  domain or application layers — not even transiently (e.g. for a JSON DTO field), since that
  reintroduces float error into a value that must round-trip exactly.
  Wrapped by a `Money` value object at the type-invariant boundary (construction may throw
  `InvalidMoneyError`; the four arithmetic operations — add, subtract, multiply, allocate — are
  pure, deterministic, and never fail given well-formed inputs).
- **FIN-4 — Rounding behavior is configured per product** via `LoanProductVersion.roundingMethod`
  (`NO_ROUNDING` | `ROUND_REMAINDER_INTO_LAST_REPAYMENT`), never hard-coded in a calculation
  routine. Any code that rounds a monetary value without consulting this field is a defect.
- **Allocation across multiple installments (e.g. splitting a payment) must always sum exactly
  back to the original amount.** A largest-remainder-style allocation algorithm is required —
  naive per-item rounding that can drift the total by a cent is not acceptable. **This applies
  identically regardless of sign** — `Money.allocate()` must split a negative amount (e.g. a
  reversal or refund) so the parts sum exactly back to the original negative amount, the same
  guarantee as for a positive amount. (Milestone 7.1 remediation, audit finding C-1: the
  original implementation distributed the remainder using the *signed* remainder directly, which
  is silently negative for a negative dividend under truncating division — the fix allocates on
  the absolute value and reapplies the sign, verified by tests covering positive, negative,
  zero, single-recipient, uneven-remainder, very-small, and large-magnitude cases.)

## 6. Concurrency

- **Optimistic concurrency control**, not pessimistic locking, is the standard approach for
  balance-mutating writes. Versioned aggregates (`LoanAccount`, and — for consistency —
  `RepaymentInstallment`) carry a `version Int` column; every mutating write is a single
  conditional `UPDATE ... SET ..., version = version + 1 WHERE id = ? AND version = ?`, mirroring
  the pattern already proven by `RefreshToken.revoke()`'s atomic conditional update (M6, C-01).
  A zero-row result raises a typed `ConcurrencyConflictError`; the calling use case may retry a
  bounded number of times within the same transaction.
- Isolation level: `READ COMMITTED` (PostgreSQL default) plus the explicit version predicate is
  sufficient for the invariants known today. Escalating to `SERIALIZABLE` is not justified
  absent a demonstrated multi-row anomaly that version checks don't already cover.
- This is a **decided-now, implemented-later** rule: no `version` column exists yet (no
  balance-mutating logic is in scope until the calculation-engine milestone), but the migration
  that adds it must follow this design, not be improvised at that time.

## 7. Aggregate & Transaction Boundaries

- Aggregates are kept small and are **not** the unit of atomicity for multi-object financial
  operations — `IUnitOfWork` (a single Prisma `$transaction` wrapping multiple repository calls)
  is. A use case that must change `LoanAccount`, insert a `LoanTransaction`, update one or more
  `RepaymentInstallment` rows, and write an `AuditLog` entry does so as one `IUnitOfWork.run()`
  call, each aggregate saved independently inside it — not by growing one aggregate to contain
  all of them.
- Cross-aggregate coordination logic (e.g. payment allocation across installments) belongs in a
  stateless **domain service**, not inside an aggregate method — this keeps aggregates small
  without losing a single, testable place for the algorithm.

## 8. Open Items That Constrain Future Work

These ADRs are unresolved. Until each is formally decided, the corresponding feature area must
not be built beyond the structural/mechanism level already present in the schema — do not infer
or invent the missing behavior.

| ADR | Constrains |
|---|---|
| ADR-007 | The formula for deriving/verifying `outstandingBalance` — no stored column exists by design |
| ADR-009 | Payment allocation order across principal/interest/fees/penalty and across installments |
| ADR-010 | Add-On vs. Contractual interest rate derivation and disclosure |
| ADR-032 | Whether "Loan Release" and "Disbursement" are one event or two — schema currently takes the two-event position as a *working assumption only* (`LoanAccount.activatedAt` vs. `DISBURSEMENT`-typed `LoanTransaction`); do not build a use case that conflates them |
| *(new, not yet formally registered)* | "Audit Logging Failure Isolation — Auth vs. Financial" — Section 4 above states the intended resolution; needs formal ADR-register entry |

## 9. Deliberate Deferrals (not oversights)

- **Domain events** are not introduced yet. No real subscriber exists (Notifications is a future
  module per `PROJECT_RULES.md §Notifications`), and synchronous events would need to be
  transaction-aware to satisfy Section 4's fail-closed audit rule — complexity not currently
  justified. Revisit once ≥2 independent consumers need to react to the same financial fact.
- **The interest/amortization calculation engine** (Flat Rate, Declining Balance, Declining
  Balance Discounted) is out of scope for Milestone 7. Structural entities, repositories, and
  lifecycle use cases (e.g. `ApproveLoanUseCase`) may be built against the existing schema;
  nothing that computes a schedule or derives a balance from a formula may be built until
  ADR-007 and ADR-009 are resolved.
