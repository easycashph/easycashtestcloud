# ADR — Financial Audit Logging Failure Isolation (Auth vs. Financial)

**Status:** Accepted (Milestone 9 design review, 2026-07-03)
**Context documents:** `docs/Architecture/FINANCIAL_INVARIANTS.md` §4 (the principle this ADR
formalizes — first stated there, not newly decided here); `app/backend/src/modules/identity/
application/ports/IAuditLogger.ts` and `.../infrastructure/PrismaAuditLogger.ts` (the existing,
deliberately different, fail-open pattern this ADR does NOT apply to); Milestone 6 audit finding
H-04 (the reasoning behind the identity module's fail-open design, which this ADR distinguishes
from, not overrides).
**Relationship to prior work:** this ADR does not introduce a new decision — it promotes an
already-agreed principle from `FINANCIAL_INVARIANTS.md §4` (a living document paragraph) to a
standalone, formally numbered ADR, per `FINANCIAL_INVARIANTS.md §8`'s own note that this
formalization was "needed" before the first multi-aggregate financial use case is implemented.
That moment has arrived with Milestone 9.

---

## 1. Decision

**Financial-write audit logging fails closed. Authentication-write audit logging fails open.
These are deliberately different, per module, and this difference must never be collapsed into a
single shared policy.**

- **Identity module (unchanged, already built):** `IAuditLogger.log()` (Milestone 6) is
  explicitly non-throwing. A transient audit-infrastructure failure during login/logout must
  never lock out a legitimate user, and must never turn a correct-password rejection into an
  opaque 500, or fail a login response after a refresh token has already been issued and
  persisted. `PrismaAuditLogger` catches its own failures and reports them via structured logging
  only.
- **Financial modules (new, this ADR): any audit-log write accompanying a financial state change
  (loan approval, activation/disbursement, payment recording, balance mutation, write-off, etc.)
  must be committed in the same database transaction, via `IUnitOfWork`, as the financial state
  change itself.** If the audit write fails, the entire transaction — including the balance/ledger
  change — rolls back. An unaudited financial state change is a worse outcome than a failed write;
  this is the opposite trade-off from the identity module's.

---

## 2. Why this, and why it differs from the identity module's pattern

An audit-infrastructure failure during login is a **degraded observability** event — the login
itself either succeeds or fails correctly regardless of whether the audit write does, and no
financial or state-changing consequence depends on the audit entry existing. An audit-
infrastructure failure during a financial write is a **correctness** event — per `PROJECT_RULES.md
§Audit Trail` ("every important action must be logged" as a hard requirement, not a best-effort
one) and `CLAUDE.md`'s "never expose sensitive information" / audit-logging security requirements,
a financial state change that occurred but left no audit trail is an unacceptable, unrecoverable
gap: there would be no record of who moved money, when, or why, for a system whose explicit
success criteria include being "Reliable," "Secure," and "Fully Documented." The two modules'
divergent designs are not an inconsistency to be reconciled — they are two different, individually
correct answers to two different questions ("should observability failures ever block a
non-financial action?" — no; "should a financial action ever complete without a trace?" — no).

---

## 3. What must be built (Milestone 9.1 implementation, not this document)

- **`IFinancialAuditLogger` port** (or an equivalently-named interface), in a location analogous
  to identity's `IAuditLogger` but scoped to financial modules — likely `shared/application/
  ports/` given it's needed by multiple modules (`loan-account`, `ledger`, `repayment`), mirroring
  how `IUnitOfWork` is placed in `shared/` rather than one module, per
  `docs/Architecture/ADR-042-aggregate-boundaries.md` §9's reasoning for cross-module capabilities.
- **Its contract must be the opposite of `IAuditLogger`'s: implementations MUST throw/propagate on
  failure**, not catch-and-log. This is the entire mechanical difference that makes fail-closed
  behavior possible — `IUnitOfWork.run()` rolls back on any exception raised inside its callback,
  so a throwing audit-write failure inside that callback is what triggers the rollback.
- **A `PrismaFinancialAuditLogger` infrastructure implementation**, writing to the same
  `AuditLog` table (`audit_logs`, already in `schema.prisma`, shared with the identity module's
  entries — no new table needed) but via a repository call that participates in the caller's
  `TransactionContext`, exactly as `PrismaLoanAccountRepository`/`PrismaRepaymentInstallment
  Repository` etc. already do via `resolveClient(ctx)`/`withTransaction(ctx, work)`
  (`shared/infrastructure/PrismaUnitOfWork.ts`).
- **Every new mutating use case built in Milestone 9.1** (`ActivateLoanUseCase`,
  `ProcessPaymentUseCase`, and any future write-exposing use case for `ledger`/`repayment`) must
  call this financial audit logger inside its `IUnitOfWork.run()` block, alongside its other
  repository writes — not before or after the transaction.

None of the above is implemented by this ADR — this document is the design decision; the code is
Milestone 9.1 (or a later checkpoint) implementation work, explicitly out of scope for this
documentation-only phase.

---

## 4. Regression test pattern required (once implemented)

Per the project's established pattern of testing exactly the failure mode a fix addresses (e.g.
Milestone 6's H-04 fail-open test for identity, `tests/unit/identity/PrismaAuditLogger.test.ts`),
the financial audit logger's introduction must ship with a **fail-closed regression test**: a
test that forces the financial audit write to fail (e.g. a mocked Prisma rejection) inside an
`ActivateLoanUseCase`-style multi-write transaction, and asserts that **all** of the transaction's
other writes (the `LoanAccount` status change, the `LoanTransaction` insert, any
`RepaymentInstallment` inserts) are rolled back — not merely that the audit write itself failed.
This is the direct financial-module counterpart to identity's fail-*open* test, and should be
written before or alongside the first real use case that exercises it, not after.

---

## 5. What this ADR does NOT decide

- **The exact shape of `AuditLogEntry`'s fields for financial actions** (whether it needs
  additional fields beyond what `identity`'s `AuditLogEntry` already has — `userId`, `action`,
  `entityType`, `entityId`, `previousValue`, `newValue`, `ipAddress`, `userAgent` — to
  meaningfully describe a financial transaction) is left to Milestone 9.1's implementation design,
  informed by what `PROJECT_RULES.md §Audit Trail` requires (User, Timestamp, IP, Browser,
  Action, Previous Value, New Value — all already covered by the existing shape) and by the
  legacy system's own richer transaction-type taxonomy (Legacy Analysis §7.8) if any of that
  granularity needs to be reflected in what gets logged.
- **Whether the financial audit logger is a single, shared port used by all financial modules, or
  one per module** — this ADR says it must exist and must fail closed; it does not mandate its
  exact placement beyond "shared, given multi-module need," which is a smaller implementation
  detail, not a architectural fork requiring its own ADR-level decision.
