# Milestone 9.1 Implementation Roadmap — v2

**Status:** Planning document (documentation only — no code, schema, tests, or migrations in this
pass). Supersedes the original 12-checkpoint roadmap presented earlier in this session, which is
not preserved as a separate file (it existed only in conversation) — this document is now the
single current plan.
**Produced:** 2026-07-03, following an independent architecture review of the original roadmap.
**Inputs:** the original roadmap; the independent architecture review (12 sections: ordering,
dependencies, risk, DDD, Clean Architecture, financial engine, concurrency, testing, missing
building blocks, technical debt, milestone assessment, final verdict); `docs/Architecture/ADR-007
-outstanding-balance-formula.md`, `ADR-009-payment-allocation-order.md`, `ADR-010-addon-vs-
contractual-interest.md`, `ADR-032-loan-release-vs-disbursement.md`, `ADR-financial-audit-
isolation.md`, `ADR-optimistic-concurrency.md`, `ADR-007_DECISION_BRIEF.md`,
`CALCULATION_ENGINE_SPEC.md`, `FINANCIAL_INVARIANTS.md`, `PROJECT_RULES.md`, `CLAUDE.md`,
`app/backend/prisma/schema.prisma`.
**Rule applied throughout:** the independent review is treated as an input, not an authority. Every
recommendation is re-evaluated against this project's own stated evidence-first and YAGNI
discipline (`CLAUDE.md`: "Don't add abstractions beyond what the task requires... Don't design for
hypothetical future requirements... Avoid unnecessary dependencies") before being accepted. No ADR
is modified — none of the review's findings contradict an ADR's content; they only refine the
implementation surface each one actually touches.

---

## Executive Summary of Changes from the Original Roadmap

1. **The single most consequential correction**: `ADR-007` §3 (does `outstandingBalance` include
   penalty?) blocks a **much narrower** slice of implementation than the original roadmap assumed.
   `LoanAccount` already has twelve separate balance columns (principal/interest/fees/penalty ×
   balance/paid/due) — ADR-007 §3 only decides how to *sum* them for display, not how they're
   stored or mutated. **CP8, CP9, and CP10 (renumbered below) are un-gated**; only a new, narrow
   checkpoint (the `outstandingBalance` summary getter) remains gated.
2. **Two premature abstractions proposed by the review are rejected or narrowed**, in favor of this
   project's own established patterns (business logic lives in aggregate methods, per `LoanAccount
   .approve()`/`.reject()`; new architectural layers are not introduced without a demonstrated
   second need). See the Decision Log for the specific reasoning on each.
3. **Two new dev-dependency proposals (property-based testing, mutation testing) are rejected** as
   disproportionate tooling investment for a project that has been deliberately dependency-
   conservative for eight milestones, with their underlying goals achieved instead through
   additional handwritten test vectors and the new golden-master checkpoint.
4. **One new checkpoint is added and accepted outright**: golden-master replay tests against real,
   already-documented legacy loans — this is the highest-value, most evidence-grounded addition the
   review produced.
5. **One new checkpoint (idempotency) is accepted only partially** — deferred to the HTTP-exposure
   checkpoint (where retries actually originate), not inserted as a blocking gate before CP9/CP10
   at the application layer, where nothing yet calls them repeatedly.
6. **The "require live Postgres" recommendation is downgraded from a hard gate to a strongly-
   encouraged, explicitly-flagged standing risk** — mandating it as a blocking requirement for this
   milestone specifically would be inconsistent with every prior milestone in this project's
   history, none of which have had live-Postgres access either.
7. Net effect: **11 of 14 checkpoints are now unblocked** (up from 6 of 12 in the original plan),
   and the plan is measurably leaner (two speculative checkpoints deferred, two proposed
   abstractions rejected) rather than simply larger.

---

## Decision Log — Every Architecture Review Recommendation

Each item is classified **Accepted**, **Partially Accepted**, or **Rejected**, with the reasoning
that produced the classification — not just the classification itself.

### §1/§2 — Ordering and Dependency Findings

| # | Recommendation | Classification | Rationale |
|---|---|---|---|
| 1 | ADR-007 §3 blocks far less than assumed; un-gate CP8/9/10, add a narrow CP for the summary getter | **Accepted** | Independently re-verified against `schema.prisma` directly (see below) — this is a factual correction, not a judgment call. `LoanAccount` has 12 separate balance columns already; `PaymentAllocationService`'s four-way split maps onto them regardless of how the summary figure is later computed. |
| 2 | Split CP7 into 7a (domain `version` prop) / 7b (repository refactor) | **Accepted** | Low cost, isolates the genuinely risky part (repository refactor) from the trivial part (an additive property), lets 7a proceed in parallel with other unblocked work. |
| 3 | Demote CP4 (Add-On/Contractual conversion) out of the critical path | **Partially Accepted — strengthened, not just demoted** | The review's own reasoning ("no evidence anything in this roadmap calls it") is correct, but the review only *demoted* it to a parallel track while fully *deferring* CP5 (partial-period interest) for the identical reason (no caller, no test vectors). Applying the review's own stated logic consistently: **CP4 is deferred, not merely demoted** — see "Deferred / Not Scheduled" below. Building a calculation service with zero current callers, before the origination/quoting tool that would need it is even scoped, is speculative work under this project's own YAGNI discipline, not "parallel-track" work worth doing now. |
| 4 | Hidden dependency: CP9 needs to verify `LoanProductVersion`'s field coverage | **Accepted, but as a checklist item, not a graph edge** | Real and worth stating explicitly, but promoting a 15-minute verification task to a first-class dependency-graph node overstates its weight. Folded into CP9's own description below. |
| 5 | CP5 (partial-period interest) has no caller — defer | **Accepted** | Directly evidenced: `CALCULATION_ENGINE_SPEC.md` §8 itself states zero real test vectors exist, and no checkpoint in either version of the roadmap calls it. |
| 6 | CP1/CP2/CP3/CP5/CP6/CP4 can run in parallel; the roadmap's numbering implied false sequencing | **Accepted** | Verified directly — these touch disjoint files with no shared state. The dependency graph below represents this as a DAG, not a numbered chain. |

### §3 — Risk Findings

| # | Recommendation | Classification | Rationale |
|---|---|---|---|
| 7 | Characterization tests before the CP7b repository refactor | **Accepted** | Directly mitigates a concretely identified regression risk (splitting a working `upsert()` that already handles three atomic writes together) against already-shipped, already-audited Milestone 7/8 code. Matches this project's own documented Lesson Learned ("verify before continuing" — `PROJECT_HANDOFF.md §11`). |
| 8 | Elevate PMT/Decimal precision testing beyond centavo-rounded spot checks | **Accepted** | Low cost, directly targets a real precision-drift failure mode, no new tooling required — achievable with plain assertions at higher decimal precision. |
| 9 | Idempotency mechanism as a new blocking checkpoint (9.5) before CP9/CP10 ship | **Partially Accepted — relocated, not inserted as a blocker** | See detailed discussion below. |
| 10 | Elevate live-Postgres verification to a hard requirement for CP9/CP10 | **Partially Accepted — downgraded to strongly-encouraged, not blocking** | See detailed discussion below. |
| 11 | Bound iteration count / document the reverse Add-On→Contractual solve as engineering-choice, not evidence-sourced | **Accepted (moot pending #3)** | Sound advice in itself; applies whenever CP4 is eventually built, not now. |
| 12 | Hardcoded allocation order risks a rewrite if ADR-009's configurability question resolves "yes" | **Partially Accepted** | See `PaymentAllocationOrder` policy discussion below (§6/§9 findings) — the underlying concern is valid, the proposed mechanism is not adopted as specified. |

#### Idempotency — detailed reasoning

The review's technical point is correct: version-based optimistic concurrency does not prevent a
*sequentially retried* request (a client timeout followed by resubmission) from being applied
twice, since each attempt individually succeeds and increments `version` cleanly. That much is
accepted without qualification.

**But the review's proposed remedy — a new blocking checkpoint before CP9/CP10 ship, piggybacking
on the audit-log write — is rejected as specified, for three reasons:**

1. **No caller exists yet that could retry.** `ActivateLoanUseCase`/`ProcessPaymentUseCase` are, at
   this point in the roadmap, called only by unit tests. HTTP exposure (which is where a real
   client timeout-and-retry scenario actually originates) is explicitly deferred (CP14). Building
   idempotency-key infrastructure before there is an HTTP caller that can exhibit the retry
   behavior is exactly the kind of "design for a hypothetical future requirement" `CLAUDE.md`
   warns against — the requirement becomes real, and worth building for, at the point a real
   caller exists.
2. **The proposed mechanism itself is under-specified and conflates two responsibilities.** The
   `AuditLog` write (via `IFinancialAuditLogger`, CP2) is a fire-and-forget action log; using it as
   a deduplication lookup would require a new *read* path (query for an existing entry matching a
   client-supplied key, before every write) that the audit logger's design was never intended to
   support. This is not a "cheap piggyback" — it is a second, different responsibility bolted onto
   a component designed for something else.
3. **No evidence source (legacy data, `PROJECT_RULES.md`, or any ADR) states an idempotency
   requirement.** This project's discipline has been to build exactly what's evidenced and flag
   everything else as an explicit, separately-tracked gap — not to pre-emptively build defensive
   infrastructure the evidence base is silent on.

**Disposition:** idempotency-key handling is **relocated to CP14 (HTTP exposure)**, where it
belongs as an interface-layer concern (a header-supplied idempotency key, checked via a small,
purpose-built lookup — not the audit logger) — and is recorded here as a **required design
consideration for CP14**, not a new blocking checkpoint now.

#### Live-Postgres requirement — detailed reasoning

The underlying concern (mocked-Prisma tests cannot verify real database-level race behavior) is
correct and already a documented, standing risk across this entire project (`PROJECT_HANDOFF.md`,
every milestone since Milestone 4). **But treating it as a hard, blocking requirement specifically
for CP9/CP10, when it has never been a blocking requirement for any of the eight prior milestones
that also touched the database** (including Milestone 6's `RefreshToken.revoke()`, which this
project's own `ADR-optimistic-concurrency.md` cites as this exact pattern's precedent) **would be
an inconsistent, newly-invented bar** — not a correction grounded in this project's actual
demonstrated environment constraints, which have never included live-Postgres access.

**Disposition:** recorded as a **strongly-encouraged, explicitly-flagged action item** — if
Postgres access becomes available before or during CP9/CP10, closing this gap for the concurrency
and fail-closed-audit scenarios specifically is the single highest-value use of that access this
project has had an opportunity for. It is not a blocking condition for committing CP9/CP10 if
access remains unavailable, consistent with how this gap has been handled in every prior milestone.

### §4/§9 — DDD and Missing Building Blocks

| # | Recommendation | Classification | Rationale |
|---|---|---|---|
| 13 | Reuse `TransactionComponents` VO instead of a new balance-effect shape | **Accepted, no reservations** | Directly verified to already exist (`modules/ledger/domain/valueObjects/TransactionComponents.ts`). Zero abstraction cost — this is DRY, not a new layer. |
| 14 | Introduce a `LoanActivationPolicy` domain service to keep business decisions out of the use case | **Partially Accepted — mechanism rejected, goal retained via existing precedent** | See detailed discussion below. |
| 15 | Introduce a `PaymentAllocationOrder` policy/strategy interface | **Partially Accepted — mechanism rejected, goal retained via encapsulation** | See detailed discussion below. |
| 16 | Do not introduce a Specification pattern | **Accepted** | Correctly self-rejected by the review itself, on the same YAGNI grounds this document applies more broadly below. No further action needed. |

#### `LoanActivationPolicy` — detailed reasoning

The review's cited precedent (the M8 audit's M-1 "mutate-then-refetch" finding) does not actually
support the specific remedy proposed. M-1 was about an extra round-trip and a race window caused
by a *use case's return-type choice* (`void` vs. returning the mutated aggregate) — it was fixed,
per the project's own handoff notes, by changing use-case return types, not by extracting a
separate policy layer. Citing it as evidence that this codebase's use cases "accrete business
logic" over-reaches what that finding actually demonstrated.

More importantly: **this codebase already has an established, precedented location for exactly this
kind of decision — the aggregate's own domain methods.** `LoanAccount.approve()`/`.reject()`
already encapsulate state-transition business rules directly on the aggregate, not in a separate
policy class, and no "Policy" pattern exists anywhere else in this codebase. Introducing one now,
for a use case (`ActivateLoanUseCase`) that — as currently scoped — performs a bounded, linear
sequence (read config → generate schedule → mutate aggregate → persist → audit) with no branching
business logic yet, would be introducing a new architectural concept the codebase has never needed
before, to solve a problem that hasn't yet appeared.

**Disposition:** the underlying goal (don't let the use case silently become a business-rule
container) is retained, but achieved via the project's own existing pattern: **the disbursement
decision logic is pushed into a new `LoanAccount.activate(...)` domain method** (see CP8 below),
exactly as `approve()`/`reject()` already do, keeping the use case a thin orchestrator by
construction rather than by introducing a new layer. If a second, sufficiently complex financial
use case later demonstrates genuine cross-cutting policy logic that doesn't fit an aggregate
method, that is the point to introduce a dedicated policy abstraction — not before.

#### `PaymentAllocationOrder` policy interface — detailed reasoning

There is currently exactly **one** evidenced implementation of the allocation order (fees →
penalty → interest → principal, sourced from one company-wide Promissory Note template), and
`ADR-009` §7 explicitly records per-product configurability as **unresolved**, not confirmed as a
future requirement. `CLAUDE.md` is unusually direct on this exact situation: "Three similar lines
is better than a premature abstraction... Don't design for hypothetical future requirements." A
strategy/policy interface with a single concrete implementation, built in anticipation of a
question that isn't even confirmed to resolve "yes," is a textbook case of what that guidance
warns against.

**Disposition:** the calculation is implemented as a plain, well-named, single-purpose function
(`PaymentAllocationCalculator`, unchanged from the original plan) rather than behind a formal
interface. The goal the review was actually reaching for — not paying a full rewrite cost if
configurability is ever confirmed — is achieved for free by good naming and a code comment citing
`ADR-009 §7` at the point of implementation, not by adding an abstraction layer today. If ADR-009's
open question is ever resolved "yes," introducing a strategy interface at that point is a small,
well-scoped, evidence-triggered change — exactly the kind of change this project's incremental
workflow is built to absorb, not something to pre-pay for now.

### §6 — Financial Engine

| # | Recommendation | Classification | Rationale |
|---|---|---|---|
| 17 | Formalize a shared `AmortizationSchedule` return type across the generator and its future consumer | **Accepted** | Trivial cost (a type/interface, not a new class or layer), prevents shape drift between CP3 and CP9. Not an abstraction in the sense CLAUDE.md warns against — it's a shared data shape, not a new indirection layer. |

### §8 — Testing Strategy

| # | Recommendation | Classification | Rationale |
|---|---|---|---|
| 18 | Invariant tests (sum-of-parts equals total, exact) | **Accepted** | Directly targets a real correctness property, implementable as plain deterministic assertions against the existing real-loan test vectors — no new tooling. |
| 19 | Property-based testing (new `fast-check` dependency) | **Rejected** | `CLAUDE.md`: "Avoid unnecessary dependencies." The stated goal (broader input coverage beyond the two hand-picked real-loan vectors) is achievable via a handful of additional handwritten edge-case vectors (zero payment, exact-tier payment, overshoot payment) without introducing a new test-tooling dependency this project has never used across eight milestones. |
| 20 | Golden-master / replay tests against real legacy loans | **Accepted, no reservations — highest-value addition from the entire review** | Directly evidence-grounded: the exact loan IDs and legacy-confirmed figures already exist, precisely cited, in the Legacy Analysis document. This is the one recommendation that most directly serves this project's stated "financial correctness over convenience" priority, at essentially zero abstraction cost (it's a test, not a new architectural layer). |
| 21 | Mutation testing (new `Stryker` dependency, one-time run) | **Rejected** | Disproportionate tooling investment: a substantial new devDependency, for a one-time, non-CI-integrated use, on code that hasn't shipped yet, in a project with no CI pipeline currently configured at all. The combination of exact real-data test vectors (CP3/CP4 existing plan) + new invariant tests (#18) + new golden-master tests (#20) already provides strong, evidenced confidence without a mutation-coverage metric. Revisit only if the calculation engine's actual defect rate after shipping turns out to warrant it — not pre-emptively. |

### §10 — Technical Debt Forecast

| # | Recommendation | Classification | Rationale |
|---|---|---|---|
| 22 | Schedule an explicit placeholder in `PROJECT_HANDOFF.md` for the five still-`UNRESOLVED` `CALCULATION_ENGINE_SPEC.md` items | **Accepted** | Zero cost, directly prevents exactly the kind of silent scope-loss this project's own discipline (tracking every deferred M-/L- finding explicitly across every milestone) is built to avoid. |

### §11/§12 — Milestone Assessment and Final Verdict

Not individually re-scored here — the review's scores were a snapshot of the *original* roadmap,
which this document materially revises (narrower ADR-007 gating, two rejected abstractions, two
rejected dependencies, one added high-value checkpoint). Re-scoring the original plan after
changing it would not be meaningful; the relevant judgment is whether *this* revised plan resolves
the review's findings adequately, which the rest of this document addresses directly.

---

## Revised Checkpoint Dependency Graph

```
 UNBLOCKED — no ADR decision required, can start immediately, wide parallelism:

 ┌─────────┐  ┌─────────┐  ┌───────────────────┐  ┌──────────────────────┐
 │ CP1      │  │ CP2      │  │ CP3                │  │ CP4                   │
 │ Concur-  │  │ Financial│  │ Declining-Balance  │  │ Payment Allocation    │
 │ rency    │  │ Audit    │  │ Interest + PMT     │  │ Calculator + Service  │
 │ infra    │  │ infra    │  │ Amortization       │  │                       │
 └────┬─────┘  └────┬─────┘  └──────────┬──────────┘  └───────────┬──────────┘
      │             │                   │                          │
      ▼             │                   │                          │
 ┌─────────┐        │                   │                          │
 │ CP5      │        │                   │                          │
 │ version  │        │                   │                          │
 │ prop on  │        │                   │                          │
 │ domain   │        │                   │                          │
 │ model    │        │                   │                          │
 └────┬─────┘        │                   │                          │
      ▼               │                   │                          │
 ┌───────────────┐    │                   │                          │
 │ CP6            │    │                   │                          │
 │ Repository     │    │                   │                          │
 │ conditional-   │    │                   │                          │
 │ write refactor │    │                   │                          │
 │ (preceded by   │    │                   │                          │
 │ characterization│   │                   │                          │
 │ tests)          │    │                   │                          │
 └───────┬────────┘    │                   │                          │
         └──────────────┼───────────────────┼──────────────────────────┤
                        │                   │                          │
                        ▼                   ▼                          ▼
                 ┌─────────────────────────────────────────────────────┐
                 │ CP7: LoanAccount balance-mutation domain methods     │
                 │ (activate(), applyPayment() — mutates the 12         │
                 │ existing component columns; decision logic lives    │
                 │ IN the aggregate method, not a separate Policy)     │
                 │ depends on: CP2, CP3, CP4, CP6                       │
                 └──────────────────────┬────────────────────────────┘
                                        │
                         ┌───────────────┴────────────────┐
                         ▼                                  ▼
              ┌─────────────────────┐          ┌──────────────────────┐
              │ CP8: ActivateLoan-   │          │ CP9: ProcessPayment-  │
              │ UseCase              │          │ UseCase               │
              │ depends on: CP7      │          │ depends on: CP4, CP7  │
              └──────────┬───────────┘          └───────────┬──────────┘
                         └────────────────┬───────────────────┘
                                          ▼
                         ┌───────────────────────────────┐
                         │ CP10: Golden-master replay     │
                         │ tests (real legacy loans)      │
                         │ depends on: CP8, CP9            │
                         └───────────────────────────────┘

 ═══════════════════════ GATE: ADR-007 §3 decision ═══════════════════════
                                          │
                                          ▼
                         ┌───────────────────────────────┐
                         │ CP11 (GATED): outstandingBalance│
                         │ summary getter + presenter      │
                         │ depends on: CP7                 │
                         └───────────────────────────────┘

 ═══════════════════════ GATE: ADR-007 §4 decision ═══════════════════════
                                          │
                                          ▼
                         ┌───────────────────────────────┐
                         │ CP12 (GATED, separate track):   │
                         │ legacy migration treatment for  │
                         │ the 79 non-reconciling loans    │
                         │ (loosely depends on CP8, CP9)   │
                         └───────────────────────────────┘

 DEFERRED / NOT SCHEDULED (no current caller — build when a real need appears):
   • Add-On ↔ Contractual rate conversion (needed only by a future loan-
     origination/quoting tool, not by CP7/CP8/CP9)
   • Partial-period / day-count interest (CALC-SPEC §8 has zero real test
     vectors and no caller in this plan)

 OPTIONAL, DEFERRED (own future milestone):
   • CP13: HTTP exposure (activate/payment routes, controllers, presenters)
     — includes idempotency-key design (relocated here per Decision Log #9)
```

**Parallelism note:** CP1, CP2, CP3, and CP4 are mutually independent and can be built in any order
or simultaneously. CP5 depends only on CP1. CP6 depends only on CP5. CP7 is the first true
convergence point, needing CP2, CP3, CP4, and CP6 together.

---

## Revised Checkpoint Ordering (Recommended Sequential Path)

If built by a single engineer/session in sequence (rather than exploiting the parallelism above),
the recommended order is:

1. CP1 — Concurrency infrastructure
2. CP2 — Financial audit infrastructure
3. CP3 — Declining-balance interest + PMT amortization
4. CP4 — Payment allocation calculator + service
5. CP5 — `version` property on domain model
6. CP6 — Repository conditional-write refactor (characterization tests first)
7. CP7 — `LoanAccount` balance-mutation domain methods
8. CP8 — `ActivateLoanUseCase`
9. CP9 — `ProcessPaymentUseCase`
10. CP10 — Golden-master replay tests
11. *(gate)* CP11 — `outstandingBalance` summary getter, once ADR-007 §3 is decided
12. *(separate track, gate)* CP12 — legacy migration treatment, once ADR-007 §4 is decided
13. *(future milestone)* CP13 — HTTP exposure, including idempotency-key design

---

## Updated Checkpoint Descriptions

### CP1 — Concurrency Infrastructure
**Objective:** `version` column (schema) + `ConcurrencyConflictError` (typed error), per
`ADR-optimistic-concurrency.md`. Unchanged from the original roadmap's Checkpoint 1.

### CP2 — Financial Audit Infrastructure
**Objective:** `IFinancialAuditLogger` port + `PrismaFinancialAuditLogger`, fail-closed, per
`ADR-financial-audit-isolation.md`. Unchanged from the original roadmap's Checkpoint 2.

### CP3 — Declining-Balance Interest + PMT Amortization
**Objective:** `CALCULATION_ENGINE_SPEC.md` §1/§2. **Change from original:** test precision
strengthened per Decision Log #8 — assert intermediate values to more decimal places than the
final centavo-rounded figure, in addition to the existing real-loan test vectors. Introduce a
shared `AmortizationSchedule` return type (Decision Log #17) used consistently by CP3 and CP8.

### CP4 — Payment Allocation Calculator + Service
**Objective:** `CALCULATION_ENGINE_SPEC.md` §5 / `ADR-009`. **Change from original:** remains a
plain function/class, not a policy interface (Decision Log #15). Add 3–4 handwritten edge-case
test vectors (zero payment, exact single-tier payment, overshoot/remainder) in place of the
rejected property-based-testing proposal (Decision Log #19).

### CP5 — `version` Property on Domain Model
**Objective:** Add `version: number` to `LoanAccountProps`/`RepaymentInstallmentProps`, exposed via
getter, no behavior change. Split out of the original roadmap's Checkpoint 7 (Decision Log #2).

### CP6 — Repository Conditional-Write Refactor
**Objective:** Split `PrismaLoanAccountRepository`/`PrismaRepaymentInstallmentRepository`'s
unconditional `upsert()` into explicit create / conditional-update (`WHERE id = ? AND version = ?`)
paths. **Change from original:** must be preceded by characterization tests capturing current
behavior (Decision Log #7), and the full existing 353-test suite must be re-run and confirmed
unchanged immediately after, not just the new tests.

### CP7 — `LoanAccount` Balance-Mutation Domain Methods
**Objective:** New domain methods `activate(...)`/`applyPayment(...)` on `LoanAccount`, mutating
the twelve *already-existing* balance component columns via a reconstructed `LoanBalances`.
**Change from original:** explicitly **un-gated** from ADR-007 (Decision Log #1); reuses the
existing `TransactionComponents` value object from the `ledger` module rather than inventing a new
balance-effect shape (Decision Log #13); the disbursement/payment decision logic is implemented
directly as aggregate methods, following the precedent of `approve()`/`reject()`, not extracted
into a separate policy class (Decision Log #14).

### CP8 — `ActivateLoanUseCase`
**Objective:** `APPROVED → ACTIVE`, schedule generation, `DISBURSEMENT` ledger entry, financial
audit, all inside `IUnitOfWork`. **Change from original:** un-gated (Decision Log #1); its
checklist must include an explicit first step verifying the existing `LoanProductVersion` domain
entity already exposes `roundingMethod`/`daysInYearConvention`/`repaymentPeriodUnit` before
implementation begins (Decision Log #4), rather than discovering a gap mid-implementation.

### CP9 — `ProcessPaymentUseCase`
**Objective:** Orchestrates CP4's allocation service with the existing
`RecordInstallmentPaymentUseCase`, a new ledger entry, and the balance update, per `ADR-009`.
**Change from original:** un-gated (Decision Log #1). The overpayment `remainder` (`CALC-SPEC §11`,
still `UNRESOLVED`) must be surfaced as an explicit output field of this use case, never silently
discarded or given an invented disposition.

### CP10 — Golden-Master Replay Tests
**New checkpoint (Decision Log #20).** **Objective:** replay the specific real legacy loans already
hand-traced across the Legacy Analysis document's four investigation passes (`SL-REG_U1V1J`,
`SL-LAZ_V5N0R`, `SL-LAZ_A6J8E`, and any others cited with exact figures) through the actual new
pipeline (`AmortizationScheduleGenerator` → `PaymentAllocationService` → `LoanAccount` mutation)
and assert the final computed state matches the legacy-recorded figures exactly. **Files to
create:** a dedicated fixture file sourcing these numbers once, directly from the Legacy Analysis
document, to avoid transcription drift across multiple test files. This is an integration-style
test exercising the full pipeline together, distinct from CP3/CP4's isolated unit tests.

### CP11 (GATED on ADR-007 §3) — `outstandingBalance` Summary Getter
**New, narrow checkpoint (Decision Log #1).** **Objective:** a single computed getter (and its
presenter wiring) on `LoanAccount` exposing whichever summary figure ADR-007 §3 selects
(penalty-inclusive, penalty-exclusive, or both as separately-named values). This is the *entire*
remaining implementation surface actually blocked by that decision — everything else in CP7–CP10
proceeds regardless.

### CP12 (GATED on ADR-007 §4, separate track) — Legacy Migration Treatment
Unchanged in substance from the original roadmap's Checkpoint 11 — a data-migration script/plan for
the 79 non-reconciling `CLOSED` loans, per whichever option (A/B/C/D) is selected from
`ADR-007_DECISION_BRIEF.md`. Does not block CP7–CP10 (per `ADR-007` §6).

### CP13 (OPTIONAL, future milestone) — HTTP Exposure
`POST /loan-accounts/:id/activate`, `POST /loan-accounts/:id/payments` (or similar), routes, Zod
schemas, controllers, `requireRole`/`branchScope` wiring, presenter updates. **Change from
original:** now explicitly includes idempotency-key handling in its scope (Decision Log #9) — a
client-supplied key, checked via a small, purpose-built lookup (not the audit logger), rejecting a
duplicate resubmission before it reaches the use case layer. Not detailed further here — a Milestone
9.2 candidate.

---

## Updated Implementation Risks

| Risk | Probability | Impact | Mitigation | Status vs. original roadmap |
|---|---|---|---|---|
| CP6 repository refactor regresses Milestone 7/8 functionality | Medium-High | High | Characterization tests + full 353-test regression run | Unchanged, retained |
| PMT/Decimal precision drift masked by centavo-rounded assertions | Medium | High | Higher-precision intermediate assertions + new invariant tests (CP10-adjacent) | Strengthened |
| Overpayment remainder given an invented disposition instead of being surfaced | Low-Medium (newly named) | Medium | Explicit output field in `ProcessPaymentUseCase`, tested | **New**, named explicitly this pass |
| Multi-module `IUnitOfWork` orchestration bug undetectable by mocked tests | Medium | High | Golden-master tests (CP10) substantially reduce this risk even without live Postgres; live-Postgres access remains strongly encouraged, not blocking | Downgraded from "requirement" to "strongly encouraged," per Decision Log #10 |
| Idempotency gap allowing duplicate activation/payment on client retry | Medium (once CP13 exists) | Very High | Deferred to CP13's explicit scope, not left unaddressed | Relocated, not dropped |
| CP7 aggregate methods accumulate untested branching logic over time | Low currently, revisit if it grows | Medium | No new abstraction added pre-emptively (Decision Log #14); revisit if a second complex use case demonstrates real shared-policy need | New framing, replaces the rejected `LoanActivationPolicy` |

---

## Updated Testing Strategy

- **Per-checkpoint unit tests** (CP1–CP9), unchanged in kind from the original roadmap, each citing
  real legacy evidence where one exists (per `CALCULATION_ENGINE_SPEC.md`'s own test-vector
  tables).
- **New invariant tests** (Decision Log #18): deterministic, not property-based — e.g.
  `Σ(principalPortion) = Principal`, `Σ(interestPortion) + Σ(principalPortion) = MonthlyPayment ×
  NumberOfInstallments`, computed against the same real-loan fixtures already in use, not
  randomized inputs.
- **New handwritten edge-case vectors** for `PaymentAllocationCalculator` (zero payment, exact
  single-tier, overshoot) in place of the rejected property-based-testing dependency.
- **New golden-master replay suite** (CP10) — the most significant testing addition, exercising the
  full pipeline against real historical loan outcomes.
- **Explicitly not adopted:** property-based testing (`fast-check`) and mutation testing
  (`Stryker`) — see Decision Log #19/#21 for the dependency-conservatism reasoning.
- **Live-Postgres verification** remains desirable, specifically for CP6's concurrency behavior and
  CP8/CP9's transaction-atomicity behavior, but is recorded as a standing, flagged risk rather than
  a blocking test requirement, consistent with this project's demonstrated environment constraints
  across every prior milestone.

---

## Updated Milestone Sequencing

- **Milestone 9.1a** (this document's CP1–CP10): fully unblocked, no business decision required,
  ready to start immediately on approval.
- **Milestone 9.1b** (CP11): gated on ADR-007 §3 — small enough to complete in a single checkpoint
  once that decision is made, does not require revisiting 9.1a's work.
- **Migration track** (CP12): gated on ADR-007 §4 — a genuinely separate workstream (data migration,
  not live calculation-engine code), can proceed on its own schedule once decided.
- **Milestone 9.2** (CP13, optional/future): HTTP exposure, only appropriate once 9.1a/9.1b's use
  cases exist as real, correctness-gated callers — matches this project's own established D-2
  precedent (`ledger`/`repayment` stayed read-only until their real callers existed).
- **Explicit placeholder recommended** (Decision Log #22): add a line to `PROJECT_HANDOFF.md`'s
  Milestone 9 section noting that Flat-Rate interest, Penalty calculation, Overpayment-mechanism
  design, Maturity-capitalization timing, and Reversal/Adjustment data-modeling remain the five
  `STATUS: UNRESOLVED` items in `CALCULATION_ENGINE_SPEC.md`, explicitly out of scope for 9.1a/9.1b,
  candidates for a future milestone once evidence or institutional input resolves them.

---

## Explicit List of Unresolved Business Decisions That Still Block Implementation

Materially shorter than in the original roadmap, per this document's central correction:

1. **`ADR-007` §3** — does `outstandingBalance` include penalty, or is it two distinct
   figures? Blocks **only CP11** (a single getter/presenter checkpoint). Does **not** block
   CP1–CP10.
2. **`ADR-007` §4** — how should the 79 non-reconciling legacy `CLOSED` loans be treated during
   migration? Blocks **only CP12** (a separate data-migration track). Does **not** block CP1–CP10.

Everything else identified as `STATUS: UNRESOLVED` in `CALCULATION_ENGINE_SPEC.md` (Flat-Rate
interest, Overpayment mechanism, Penalty calculation, Maturity-capitalization timing, Reversal/
Adjustment data modeling) is **out of scope for this roadmap entirely**, not a blocker to be
resolved before CP1–CP10 — those calculations simply aren't being built in this pass.

---

## Final Recommended Implementation Order

**Start immediately, no decision required:** CP1 → CP2 → CP3 → CP4 → CP5 → CP6 → CP7 → CP8 → CP9 →
CP10 (or any parallel ordering respecting the dependency graph above).

**Do not start until `ADR-007` §3 is decided:** CP11.

**Do not start until `ADR-007` §4 is decided (separate track, does not block the above):** CP12.

**Defer to a future milestone:** CP13 (HTTP exposure), and the two deferred/not-scheduled
calculations (Add-On/Contractual conversion, partial-period interest) until a real caller for
either is scoped.

---

## Preserved ADRs — No Contradictions Found

Every ADR produced in the Milestone 9 documentation phase (`ADR-007`, `ADR-009`, `ADR-010`,
`ADR-032`, `ADR-financial-audit-isolation`, `ADR-optimistic-concurrency`) remains unchanged by this
document. Nothing in the independent review or this re-evaluation surfaced a contradiction with any
ADR's content or status — only a clarification of how narrowly `ADR-007`'s open questions actually
constrain the implementation surface, which is a planning-document correction, not an ADR
amendment. `ADR-007` itself remains **PARTIALLY ACCEPTED**, exactly as before.
