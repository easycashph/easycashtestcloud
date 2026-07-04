# ADR-048 — Optimistic Concurrency for Balance-Mutating Writes

**Status:** Accepted (Milestone 9 design review, 2026-07-03)
**Context documents:** `docs/Architecture/FINANCIAL_INVARIANTS.md` §6 (the principle this ADR
formalizes — first stated there, not newly decided here); `app/backend/src/modules/identity/
infrastructure/` `RefreshToken.revoke()`'s atomic conditional update (Milestone 6, audit finding
C-01 — the existing precedent this design mirrors); `docs/Architecture/ADR-042-aggregate-
boundaries.md` §11 (explains why small aggregates make this strategy viable at this project's
scale).
**Relationship to prior work:** this ADR does not introduce a new decision — it promotes an
already-agreed principle from `FINANCIAL_INVARIANTS.md §6` to a standalone, formally numbered ADR,
consistent with the same "decided-now, implemented-later, needs its own ADR file before the first
real implementation" pattern used for the Financial Audit Isolation ADR. Milestone 9 is the first
milestone with balance-mutating writes, making this the right moment to formalize it.

---

## 1. Decision

**Optimistic concurrency control, not pessimistic locking, is the standard mechanism for every
balance-mutating write in this system.** Versioned aggregates (`LoanAccount`, and — for
consistency — `RepaymentInstallment`) carry a `version Int` column. Every mutating write is a
single, conditional SQL statement:

```sql
UPDATE loan_accounts
SET principal_balance = ?, ..., version = version + 1
WHERE id = ? AND version = ?
```

A zero-row result (the `WHERE` clause matched no row, because `version` had already advanced)
raises a typed `ConcurrencyConflictError`. The calling use case may retry a bounded number of
times within the same transaction, or surface the conflict to the caller as a `409 Conflict`.

**Isolation level: PostgreSQL's default, `READ COMMITTED`, plus the explicit `version` predicate,
is sufficient.** Escalating to `SERIALIZABLE` is explicitly not adopted — no demonstrated
multi-row anomaly in this system's invariants requires it, and adopting it without one would be
unjustified complexity per this project's stated cost-minimization and simplicity principles
(`CLAUDE.md` — "avoid unnecessary dependencies," "favor readability over cleverness," applied here
to database isolation strategy rather than code).

---

## 2. Why optimistic, not pessimistic

This mirrors the precedent already proven in this codebase: `RefreshToken.revoke()` (Milestone 6,
audit finding C-01) already uses exactly this pattern — an atomic conditional `UPDATE` with a
version-equivalent guard — for a much simpler single-field case. This ADR extends the same,
already-validated mechanism to financial balance fields, rather than introducing a second,
different concurrency strategy.

Small, minimally-scoped aggregates (per `docs/Architecture/ADR-042-aggregate-boundaries.md`
§5–§7 — `LoanAccount` does not own `LoanTransaction` or `RepaymentInstallment`, each of which is
its own independent aggregate) is the design precondition that makes optimistic concurrency the
right choice at this project's target scale (100,000+ loans, millions of payments, per
`CLAUDE.md`): a `version` column scoped to one `LoanAccount` or one `RepaymentInstallment`
produces far fewer false conflicts than a `version` column scoped to a whole schedule or an
entire loan's transaction history would (ADR-042 §11, already reasoned through before this
milestone). Pessimistic locking (`SELECT ... FOR UPDATE`) would hold row locks for the duration of
a request, which does not scale to this system's stated concurrent-user and transaction-volume
targets, and is unnecessary given the small blast radius of each aggregate.

---

## 3. What must be built (Milestone 9.1 implementation, not this document)

- **A migration adding `version Int @default(0)` to `LoanAccount` and to the `RepaymentSchedule`
  table** (the Prisma model backing the `RepaymentInstallment` aggregate — note the table is named
  `repayment_schedules` in `schema.prisma` while the domain aggregate is named
  `RepaymentInstallment`; this ADR uses the aggregate's name for clarity but the migration targets
  the actual table). No `version` column exists on either today — `FINANCIAL_INVARIANTS.md §6`
  explicitly notes this was "decided-now, implemented-later" specifically because no
  balance-mutating logic existed yet to need it. That gap closes with this milestone.
- **A new `ConcurrencyConflictError` class**, extending the existing `DomainError` base
  (`shared/errors/DomainError.ts`), with `httpStatus: 409` — following the exact pattern already
  used for `NotFoundError` (404), `ValidationError` (400), and `ForbiddenError` (403). No changes
  to `errorHandler` (`shared/middleware/errorHandler.ts`) are needed, since it already maps any
  `DomainError` subclass to its declared `httpStatus` generically.
- **Repository method changes**: `PrismaLoanAccountRepository.save()`/`update()` and
  `PrismaRepaymentInstallmentRepository.save()` must change from unconditional upserts to
  conditional `UPDATE ... WHERE id = ? AND version = ?` calls (using Prisma's `updateMany` with a
  `where` clause including `version`, checking the returned `count`, since Prisma's typed `update`
  does not natively support "affected rows" semantics the way raw SQL does — the exact
  implementation approach is Milestone 9.1's concern, not this ADR's).
- **Every new mutating use case in Milestone 9.1** (`ActivateLoanUseCase`, `ProcessPaymentUseCase`)
  must read an aggregate's current `version` before mutating it, and pass that version through to
  the repository's conditional write, retrying (per §1) or surfacing a `409` on conflict.

None of the above is implemented by this ADR — this document is the design decision; the code is
Milestone 9.1 (or a later checkpoint) implementation work, explicitly out of scope for this
documentation-only phase.

---

## 4. Regression test pattern required (once implemented)

A concurrency regression test simulating two concurrent conditional updates against the same
`LoanAccount`/`RepaymentInstallment` (same starting `version`) must assert the second write
raises `ConcurrencyConflictError`. Per this project's established mocked-Prisma testing pattern
(`docs/PROJECT_HANDOFF.md §7`), asserting the conditional `WHERE version = ?` clause is
constructed correctly and that a zero-affected-rows result raises the typed error is sufficient
for the unit-test layer; genuine concurrent-write behavior under real simultaneous transactions
requires the live-Postgres integration test suite (`RUN_INTEGRATION_TESTS=1`), which has never
been exercised in this project's history — this is flagged as a standing verification gap this
milestone should consider closing (see `docs/Legacy Analysis/...` and the handoff's "no live
Postgres" recurring risk note), not a requirement this ADR imposes.

---

## 5. What this ADR does NOT decide

- **The bounded retry count** for a use case that encounters a `ConcurrencyConflictError` (retry
  once? three times? not at all, always surface to the caller?) — left to Milestone 9.1's
  implementation, informed by expected real-world contention rates once observed, not decided in
  advance without data.
- **Whether `version` should be exposed in any HTTP response** (e.g. for optimistic-concurrency-
  aware clients to detect staleness) — out of scope; the existing presenter pattern
  (`docs/PROJECT_HANDOFF.md §8`) governs what fields are serialized, and this ADR does not mandate
  a change to it.
- **Whether other aggregates beyond `LoanAccount`/`RepaymentInstallment` need a `version` column**
  — `FINANCIAL_INVARIANTS.md §6` scopes this to "balance-mutating writes," which today means only
  these two aggregates; if a future milestone introduces another balance-mutating aggregate, it
  should adopt this same pattern by extension of this ADR's reasoning, not require a new ADR to
  re-derive it.
