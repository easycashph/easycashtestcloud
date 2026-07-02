# ADR-042 — Aggregate Boundaries and Transaction Boundaries

**Status:** Accepted (Milestone 7 design review, 2026-07-02)
**Context document:** `docs/PROJECT_HANDOFF.md`, `docs/Architecture/FINANCIAL_INVARIANTS.md`
**Supersedes:** nothing. First formal ADR file persisted to `docs/Architecture/` (the Phase 1
ADR register itself remains unpersisted — see the caveat at the top of `PROJECT_HANDOFF.md`).

---

## 1. Decision

Milestone 7's five new bounded-context modules (`borrower`, `loan-product`, `loan-account`,
`ledger`, `repayment`) are built around the following aggregate boundaries. Each aggregate is a
separate transactional-consistency unit; nothing outside an aggregate's own repository may
mutate its internal state directly, and aggregates reference each other **by ID only**, never
by object graph.

| Aggregate Root | Module | Owned entities (inside the boundary) | Referenced by ID only (outside the boundary) |
|---|---|---|---|
| `Borrower` | `borrower` | `BorrowerIncomeDetail`, `BorrowerGovernmentId`, `IdentificationDocument[]`, `CharacterReference[]`, `Address[]` (Value Objects) | `Branch`, `User` (assigned loan officer) |
| `CoBorrower` | `borrower` | `Address[]` (Value Objects) | `LoanAccount` (via `LoanAccountCoBorrower` join) |
| `LoanProduct` | `loan-product` | `LoanProductVersion[]`, and per version: `PenaltyRule`, `FeeRule[]` | — |
| `LoanAccount` | `loan-account` | `AppliedFee[]`, `LoanAccountCoBorrower[]` (join) | `Borrower`, `LoanProductVersion`, `Branch`, `User` (officer/approver), `LoanTransaction`, `RepaymentInstallment` |
| `LoanTransaction` | `ledger` | — (single-entity aggregate; immutable, append-only) | `LoanAccount`, `User` (poster), `Branch` |
| `RepaymentInstallment` | `repayment` | — (single-entity aggregate, one row per installment) | `LoanAccount` |

`Address` is modeled as a **Value Object**, not an aggregate or entity — see §7. It has no
independent identity and is owned wholesale by whichever aggregate holds it.

---

## 2. Why `Borrower` is an Aggregate Root

`Borrower` has independent business identity (referenced by loan number, government ID, and
name in search — `PROJECT_RULES.md §Search`), an independent lifecycle (`ACTIVE`/`INACTIVE`
status, `loanCycle` counter), and owns several child records whose existence is meaningless
without it — `BorrowerIncomeDetail`, `BorrowerGovernmentId`, `IdentificationDocument`,
`CharacterReference` are all `onDelete: Cascade` in the schema, i.e. the database itself encodes
that these children cannot outlive their `Borrower`. That cascade relationship is the schema's
reflection of a true aggregate consistency boundary: a `Borrower` and its income/ID/reference
records are always created, loaded, and invalidated together as one conceptual unit. No other
aggregate needs transactional consistency with a `Borrower`'s internal child records — a
`LoanAccount` only ever needs `borrowerId`, never the borrower's income detail or ID documents
inside the same transaction.

## 3. Why `CoBorrower` is its own Aggregate, not part of `Borrower` or `LoanAccount`

A `CoBorrower` is a person record with its own name, contact info, and (potentially) its own
addresses — structurally a peer of `Borrower`, not a child of it. It cannot be a child of
`LoanAccount` either: ADR-015 (per-borrower vs. per-loan co-borrower scope) is still open, and
the schema's `LoanAccountCoBorrower` join table was deliberately built to be compatible with
*either* resolution — a co-borrower reusable across multiple loans, or scoped to exactly one.
Modeling `CoBorrower` as a dependent child of whichever `LoanAccount` first references it would
silently pre-decide ADR-015 in the "per-loan" direction, which is not this ADR's decision to
make. Keeping `CoBorrower` as an independent aggregate, referenced from `LoanAccount` only via
the join table's `coBorrowerId`, stays correct regardless of how ADR-015 is eventually resolved.

## 4. Why `LoanProduct` owns `LoanProductVersion`

LPV-2 ("at most one `LoanProductVersion` per product may be Active") is a **cross-child
invariant** — it constrains the relationship between sibling `LoanProductVersion` rows under the
same product, not any single version in isolation. In DDD, an invariant that spans multiple
child entities belongs inside the aggregate that owns all of them, because only the aggregate
root can guarantee it's enforced atomically: activating a new version must, as one operation,
deactivate whichever version is currently active. If `LoanProductVersion` were its own aggregate,
enforcing LPV-2 would require an application-layer transaction coordinating two "independent"
aggregates every single time a version is activated — turning a routine, single-entity-feeling
operation into a mandatory cross-aggregate transaction. Making `LoanProduct` the root and
exposing a single `activateVersion(versionId)` operation on it keeps the invariant's enforcement
in exactly one place. The database's partial unique index
(`20260702010000_schema_review_indexes_and_lpv2_guard`) remains a backstop, not a substitute —
application code must not rely on the database to catch a bug it should have prevented.

`PenaltyRule` and `FeeRule` are, in turn, owned by the specific `LoanProductVersion` they belong
to (not by `LoanProduct` directly) — they are part of the immutable, versioned rule snapshot
(LPV-1) and must never be shared or reinterpreted across versions.

## 5. Why `LoanAccount` owns `AppliedFee` but not `LoanTransaction`

Both relate to a loan financially, but they differ in exactly the property that matters for
aggregate design: **volume and mutation pattern**.

- `AppliedFee` rows are few per loan (one per triggered `FeeRule` — typically a handful over a
  loan's lifetime: processing fee, service fee, insurance, maybe one or two penalty-adjacent
  fees). They are written at well-defined moments (disbursement, or a manual trigger) and, once
  written, are immutable (FEE-4) but still conceptually "part of what this loan currently has
  applied to it" — a small, bounded collection that's reasonable to load alongside the loan
  account itself when displaying "this loan's current fee breakdown."
- `LoanTransaction` rows are the system's single highest-volume table by design (524k rows in
  the legacy system already, with 100,000+ loans and "millions of payments" as this project's
  explicit stated scale target per `CLAUDE.md`). Treating it as a child collection of
  `LoanAccount` would mean any operation on a loan risks implicitly touching or loading an
  unbounded, ever-growing history — the exact anti-pattern that makes aggregates fail to scale.
  `LoanTransaction` is also explicitly append-only (TXN-1) with its own reversal-linking
  structure (`reversesTransactionId`) — a self-contained record that never needs another
  aggregate's cooperation to remain internally consistent.

The dividing line, generalized: a child belongs *inside* the aggregate when its collection is
small, bounded, and needed to answer "what does this loan currently look like"; a child becomes
its *own* aggregate when it's an ever-growing historical record whose consistency needs stop at
its own row.

## 6. Why `LoanTransaction` is an independent Aggregate Root

Beyond the volume argument in §5: `LoanTransaction` is designed to be **immutable after
creation** (TXN-1 — corrections are new reversal transactions, never edits). An immutable,
independently-identified, append-only record with no need for any other object's cooperation to
stay valid is close to the textbook definition of a minimal aggregate — one entity, one
invariant ("once written, never changes"), enforced entirely by the repository's own contract
(`ILoanTransactionRepository` exposes no `update()`/`delete()` method at all — the port's type
signature makes the invariant impossible to violate from the application layer, not just
discouraged by convention).

## 7. Why `RepaymentInstallment` is an independent Aggregate Root, not a child of a `RepaymentSchedule` aggregate

This was the most closely-contested boundary decision and deserves the fullest justification.

**The naive alternative** is a `RepaymentSchedule` aggregate — one object per loan, containing
all of its `RepaymentInstallment` rows as children — on the theory that "the schedule" is a
single coherent thing a user reasons about together.

**Why that alternative was rejected**, applying Vernon's aggregate-design heuristic (model only
*true* transactional invariants; favor small aggregates; use process-level/application
transactions for the rest):

1. **The one real cross-row invariant is enforced at creation, not continuously.** REPAY-3
   ("status must be derivable from due/paid amounts and due date") is evaluated per row — it
   never requires comparing one installment to another. The only genuine cross-row invariant —
   "the sum of all installments' `*Due` amounts equals the loan's principal/interest/fees/
   penalty totals" — is guaranteed by construction at schedule-generation time (a single batch
   write, produced by the not-yet-built amortization engine) and is never at risk afterward,
   because `*Due` fields are immutable post-generation except through a formal restructuring
   event (ADR-041, out of scope). An invariant that's established once at creation and never
   threatened again does not require an ongoing shared consistency boundary to protect it.
2. **Concurrency cost of the alternative.** Recording a payment is the highest-frequency
   financial write in this system (`PROJECT_RULES.md §Payments`: partial, full, advance,
   overpayment, reversal, refund, adjustment all flow through here). A payment typically touches
   one or two installments. If all of a loan's installments lived inside one `RepaymentSchedule`
   aggregate, every payment-recording transaction would need to load and (per
   `FINANCIAL_INVARIANTS.md §6`) version-lock the *entire* schedule — turning a two-row write
   into a whole-schedule write, and creating false write contention between operations that
   don't actually conflict (e.g. two different installments of the same loan being adjusted by
   two different, legitimate concurrent operations would collide on the shared schedule version
   even though neither touches the other's row).
3. **Scale.** ~100,000+ loans × ~20-24 installments each is a multi-million-row table —
   structurally the same shape as the `LoanTransaction` volume argument in §5/§6. "Load the
   whole collection to change one row" was already rejected there; it should not be re-admitted
   here just because installments feel more bounded per loan than transactions do.

**The ergonomic loss is real, and is addressed differently, not ignored:** the one legitimate
reason to want a `RepaymentSchedule` aggregate is to have a natural home for "apply this payment
across N installments in the right order." That operation is deliberately **not** placed inside
an aggregate at all — it belongs in a stateless **domain service**
(`PaymentAllocationService`, to be built once ADR-009 is resolved), which takes the relevant
`RepaymentInstallment[]` loaded via the repository, an allocation policy, and a payment amount,
and returns the set of updated installments. The application-layer use case then persists each
changed installment inside one `IUnitOfWork` transaction (§8). Atomicity for that specific
operation is achieved at the **transaction boundary** (explicit, use-case-scoped, exactly as
wide as that one operation needs), not by permanently widening the **aggregate boundary** to
cover every future multi-installment operation whether or not it needs one.

## 8. Why `Address` is a Value Object, not an Aggregate

Evaluated independently of the database's polymorphic `ownerType`/`ownerId` storage (that's a
persistence trade-off, not a domain-modeling reason — conflating the two was an error corrected
during design review):

- **No independent business identity.** Nothing in `PROJECT_RULES.md` or the observed legacy
  data references "this specific address record" apart from the person who lives there. No
  business operation looks an address up by its own ID; it is only ever meaningful as "this
  borrower's home address" or "this co-borrower's work address."
- **Replaced as a whole, not edited in place.** When a borrower's address changes, the domain
  operation is "the borrower now has this address," not "mutate the street field of an existing,
  independently-tracked Address entity." That is exactly Value Object semantics — compared by
  value, immutable, replaceable wholesale.
- **Multiplicity does not imply entity-ness.** `PROJECT_RULES.md` allows multiple addresses per
  borrower; this is satisfied by `Borrower.addresses: Address[]`, a value collection
  distinguished by `addressType`, with no individual address needing standalone identity beyond
  that. (Address is the canonical Value Object example in DDD literature for exactly this
  reason.)
- **The counter-case that would change this conclusion, and why it doesn't apply:** if a
  business rule required cross-borrower address deduplication as its own tracked concept (e.g.
  "flag when two different borrowers share an address, as a fraud signal"), that rule would need
  Address to carry independent identity, pushing it toward Entity/Aggregate status. No such rule
  exists today — `PROJECT_RULES.md`'s duplicate-detection language concerns matching borrowers,
  not addresses. If that rule is introduced later, address-level deduplication should be handled
  by a domain service consuming address *values*, which does not require promoting Address to
  an aggregate.
- **Persistence note, kept separate from the above:** the `addresses` table still has its own
  UUID primary key, because Prisma requires one and because updating/removing one address among
  several requires *a* row identifier. That is a mechanical requirement of the ORM, not evidence
  of domain identity — a database primary key on a value's storage row does not make that value
  an Entity. `Address` is loaded and saved as part of whichever aggregate owns it
  (`IBorrowerRepository`/`ICoBorrowerRepository` query by `ownerType`+`ownerId` internally);
  there is no `IAddressRepository`, and no application-layer code ever references an address by
  its own ID independent of its owner.

## 9. Why transaction boundaries are handled by `IUnitOfWork`, not by widening aggregates

Every aggregate-boundary decision above (§5, §6, §7) deliberately favors small, single-entity or
tightly-bounded aggregates, on the premise that this system's dominant scaling pressure is write
volume on the ledger/schedule tables. But real use cases still need to change multiple aggregates
atomically — e.g. approving a loan writes to `LoanAccount`; a future payment-recording use case
will write to `LoanTransaction`, `LoanAccount`, and one or more `RepaymentInstallment` rows
together.

**Aggregate boundary and transaction boundary are two different concepts, and this project
deliberately does not conflate them:**

- **Aggregate boundary** = the smallest set of data that must be consistent with itself at all
  times, enforced by that aggregate's own repository and domain methods, independent of any
  particular use case.
- **Transaction boundary** = the set of writes that a *specific use case* needs to happen
  atomically, as a database transaction. This can — and in a system built from small aggregates,
  routinely will — span multiple aggregates.

`IUnitOfWork` (`shared/application/ports/IUnitOfWork.ts`, implemented by
`shared/infrastructure/PrismaUnitOfWork.ts`) is the mechanism that supplies the second concept
without requiring the first to grow to match it. A use case that must change `LoanAccount`,
insert a `LoanTransaction`, and update `RepaymentInstallment` rows together calls
`unitOfWork.run(async (ctx) => { ...multiple repository calls, each passed ctx... })`; each
aggregate is still saved through its own repository, preserving its own invariants
independently, but all the writes commit or roll back together as one unit. This keeps
aggregates small (§5–§7's scaling argument intact) while still giving use cases real atomicity
where the business genuinely requires it.

## 10. Relationship between Aggregate Boundary and Transaction Boundary

To state the relationship precisely, since it is the organizing principle behind every decision
above:

> **An aggregate boundary is the *minimum* unit of consistency. A transaction boundary is the
> *actual* unit of atomicity for one use case, and is always greater than or equal to the
> aggregate boundary — never smaller.**

A single-aggregate use case (e.g. `ApproveLoanUseCase`, changing only `LoanAccount`'s status)
needs no `IUnitOfWork` at all — its one repository call is already atomic at the database level.
A multi-aggregate use case needs `IUnitOfWork` specifically because no single aggregate's
repository can offer atomicity across a boundary it doesn't own. This project's aggregates are
deliberately kept at their *natural* minimum size (driven by true invariants, not by "what's
convenient for the use case that happens to need several of them together"), and `IUnitOfWork`
is the explicit, visible mechanism that reconciles that minimalism with the atomicity individual
use cases actually require. A reader auditing a use case can see its transactional scope
directly from whether it takes an `IUnitOfWork` dependency and how many repositories it calls
inside `run()` — the transaction boundary is never implicit or hidden inside an
artificially-widened aggregate.

## 11. Future implications for scalability and consistency

- **Scalability:** because `LoanTransaction` and `RepaymentInstallment` are independent,
  minimally-scoped aggregates, read/write load against the highest-volume tables in the system
  never requires loading or locking unrelated data (e.g. a loan's full transaction history, or
  its entire installment schedule) for operations that don't need it. This is the design
  precondition for meeting `CLAUDE.md`'s stated 100,000+ loans / millions-of-payments target —
  the alternative (schedule- or ledger-as-aggregate) would not scale to that target without a
  later, disruptive redesign.
- **Consistency:** the trade-off of small aggregates is that **cross-aggregate consistency is
  eventual within a single request**, not automatic — it exists only where a use case explicitly
  wraps it in `IUnitOfWork`. This is a deliberate, visible cost, not an accident: any future
  developer adding a new multi-aggregate use case must consciously reach for `IUnitOfWork` and
  think through exactly which writes need to be atomic together. This project accepts that cost
  in exchange for aggregates that scale independently.
- **Concurrency:** small aggregates are also what makes the optimistic-concurrency strategy in
  `FINANCIAL_INVARIANTS.md §6` viable — a `version` column scoped to one `LoanAccount` (or one
  `RepaymentInstallment`) produces far fewer false conflicts than a `version` column scoped to
  an entire schedule or an entire loan's transaction history would.
- **Domain Events (deferred, per `FINANCIAL_INVARIANTS.md §9`):** this aggregate design is
  compatible with introducing domain events later without rework — e.g. `LoanApproved`,
  `PaymentRecorded` — precisely because aggregates already communicate by ID reference rather
  than object graph. Events, when introduced, would simply formalize a notification pattern that
  the ID-only reference discipline already assumes.
- **Audit isolation ADR:** the fail-closed, same-transaction audit-write rule
  (`FINANCIAL_INVARIANTS.md §4`) depends directly on `IUnitOfWork` existing as a cross-module
  primitive — without it, there would be no mechanism to guarantee a financial write and its
  audit entry commit or roll back together.
