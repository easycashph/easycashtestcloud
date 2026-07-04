# EasyCash Digital Lending Platform — Project Handoff

**Purpose:** a complete, self-contained briefing for a brand-new Claude Code conversation that
has never seen this project before. It reflects the repository state through **Milestone 9.1
checkpoint 10** (golden-master replay tests), verified directly against the repository rather
than reconstructed from memory. **Read this document in full before touching any code.** If
anything here conflicts with what you observe in the repository, trust the repository and update
this document.

---

## 1. Current Project State

- **Current branch:** `main`, up to date with `origin/main`. **Working tree is clean.**
- **Latest committed commit:** `9b65624` — "Milestone 9.1 checkpoint 10: golden-master replay
  tests".
- **Latest completed implementation:** Milestone 9.1 **CP10** (golden-master replay tests), per
  `docs/Architecture/MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`'s checkpoint numbering. CP1–CP10
  are implemented, verified, and committed. **CP11 (`outstandingBalance` summary getter) remains
  GATED on `ADR-007` §3 — not started, and should not be started until that ADR is decided.**
- **Overall status:** Backend has a working, tested HTTP API for `identity`, `borrower`,
  `loan-product`, `loan-account` (full CRUD-ish surfaces) and `ledger`/`repayment`
  (deliberately **read-only**). Core domain layer (Milestone 7) is complete and audited/remediated
  (Milestone 7.1). HTTP layer (Milestone 8) is complete and audited/remediated (Milestone 8.1).
  Milestone 9's documentation/architecture phase (legacy-evidence analysis, ADRs, the calculation
  engine spec, and the v2 implementation roadmap) is complete and committed.
  **Milestone 9.1 implementation status:**
  - **CP1 (concurrency infra), CP2 (financial audit infra), CP3 (declining-balance interest + PMT
    amortization), CP4 (payment allocation calculator + service), CP5 (`version` property), CP6
    (repository conditional-write refactor), CP7 (`LoanAccount` balance-mutation domain methods),
    CP8 (`ActivateLoanUseCase`), CP9 (`ProcessPaymentUseCase`) — Done, committed.**
  - **CP10 (golden-master replay tests) — Done, committed (`9b65624`).** Exercises the full
    pipeline (`AmortizationScheduleGenerator` → `PaymentAllocationService` →
    `LoanAccount`/`RepaymentInstallment` mutation) through the real `ActivateLoanUseCase`/
    `ProcessPaymentUseCase` orchestrators against three real, hand-traced legacy loans
    (`SL-REG_U1V1J`, `SL-LAZ_V5N0R`, `SL-LAZ_A6J8E` — figures transcribed once into
    `tests/integration/loan-account/goldenMasterFixtures.ts`, cited to their exact Legacy Analysis
    §3.1/§3.2/§8.3/§8.9 and `ADR-007` §1 evidence lines), asserting exact centavo matches. Uses
    mocked repositories (in-memory), not a live database — closes the calculation-correctness gap
    only; live-Postgres transaction-atomicity verification remains the project's already-
    documented standing risk. `firstRepaymentDate` for the two single-installment loans (no
    schedule due date recorded in evidence) uses a documented disbursement-date-or-placeholder
    proxy, explicitly noted as having zero effect on any asserted figure. Deliberately excludes
    `ADR-046` (not evidenced against these three loans) and `SL-LAZ_A6J8E`'s anomalous
    post-reconciliation transactions (Legacy Analysis §3.1.1, `STATUS: UNRESOLVED`).
  - **CP11 (`outstandingBalance` summary getter) — GATED, not started.** Per the roadmap, this is
    the *only* remaining implementation surface blocked by `ADR-007` §3 (whether
    `outstandingBalance` is penalty-inclusive, penalty-exclusive, or both as separate fields) —
    everything through CP10 proceeds regardless of that open decision.
  - **A real bug was found and fixed in CP8's `ActivateLoanUseCase`** (commit `9476848`, before
    CP9 began): it computed `monthlyContractualRate` as `loanAccount.contractualInterestRate ??
    loanAccount.interestRate`, implicitly treating `contractualInterestRate` as
    higher-precedence. No ADR supports this — `ADR-010` §1 names `LoanAccount.interestRate`
    itself as the rate the amortization formula requires; `contractualInterestRate`/
    `addOnInterestRate` are both optional, disclosure-oriented fields not guaranteed to be
    populated or consistent with `interestRate` on every loan. A loan originated via the
    Add-On-quoted path with a divergent `contractualInterestRate` would have silently computed
    interest against the wrong rate — no existing test caught it, since every prior test left
    `contractualInterestRate` undefined. **Fixed to use `interestRate` directly**, with a new
    regression test constructing a loan where the two rates deliberately diverge.
  - `firstRepaymentDate` is a **required** field on `LoanAccount` (added in CP8, via a
    hand-authored migration, no default — per `ADR-045`, no rule exists to fabricate one). This
    required a consequential update to the already-HTTP-exposed loan origination path:
    `CreateLoanAccountUseCase`, its DTOs, Zod schema, and presenter all now accept/validate/
    persist/present it.
  - CP1–CP9's calculation/repository pieces are wired into real use cases (CP8, CP9) and now
    verified end-to-end against real legacy data (CP10). No HTTP route exists for either use case
    yet (CP13, future milestone — D-2 precedent). No notifications or reporting modules exist yet
    (`document`/`audit` module folders remain `.gitkeep` scaffolds under `src/modules/`).
  - Two new ADRs since Milestone 9's original documentation phase: **`ADR-045`** (repayment
    schedule due-date generation — Concept 1, Exact First Repayment Date, **Accepted**) and
    **`ADR-046`** (Advance Interest Fee on Extended First-Repayment Gap — **Accepted**, rate
    basis/trigger/rounding all confirmed; which `LoanProductVersion`s should enable it is the one
    open item, not a blocker for any implemented checkpoint). Two previously-unnumbered ADRs were
    also renamed for consistency: `ADR-financial-audit-isolation.md` →
    `ADR-047-financial-audit-isolation.md`, `ADR-optimistic-concurrency.md` →
    `ADR-048-optimistic-concurrency.md` (filename/reference-only change, no decision content
    altered).
- **Latest commits (newest first):**
  ```
  9b65624 Milestone 9.1 checkpoint 10: golden-master replay tests
  08345f3 Milestone 9.1 checkpoint 9: ProcessPaymentUseCase (cross-installment allocation, ledger, fail-closed audit)
  9476848 fix: use LoanAccount.interestRate directly for amortization, not contractualInterestRate
  39fc312 docs: update PROJECT_HANDOFF.md for Milestone 9.1 CP8 completion
  ce21160 Milestone 9.1 checkpoint 8: ActivateLoanUseCase (schedule generation, disbursement ledger, fail-closed audit)
  146d9f6 docs: replace README.txt with a professional README.md
  47c7404 docs: add ADR-046, renumber ADR-047/048, fix stale cross-references
  3b46391 docs: accept ADR-045 (Concept 1 - Exact First Repayment Date)
  ef94d6d docs: document unresolved repayment due-date generation decision
  618b210 docs: update PROJECT_HANDOFF.md for Milestone 9.1 CP6-CP7 completion
  3b5c502 Milestone 9.1 checkpoint 6-7: repository conditional-write refactor + LoanAccount balance-mutation domain methods
  4a9f540 docs: ADR-044 - separate customer identity model for future Public Portal
  36e7f3d Portability: replace Prisma.Decimal with decimal.js in domain/application layer
  f57efc3 Milestone 9.1 checkpoint 5: version property on LoanAccount/RepaymentInstallment domain model
  ```
- **Current test counts (verified fresh, not from memory, 2026-07-05, includes CP10):** **460
  unit tests passing, 0 failing, 6 integration tests correctly skipped** (74 test files total; up
  from 456/73 before CP10 — the +4 are CP10's golden-master replay tests
  (`tests/integration/loan-account/GoldenMasterReplay.test.ts`). These 4 use mocked repositories,
  not a live database, so they run unconditionally as part of the normal suite — they are
  distinct from, and not gated by, the same `RUN_INTEGRATION_TESTS=1`/live-Postgres flag that
  gates the other 6 skipped integration tests).
- **Verification status (all re-run and confirmed clean immediately before writing this
  document, 2026-07-05, against the working tree including CP10):**
  - `npx eslint "src/**/*.ts"` (from `app/backend/`) — clean, zero errors/warnings.
  - `npx tsc -p tsconfig.json --noEmit` — clean, zero errors.
  - `npx prisma validate` — schema valid (requires `DATABASE_URL` to be set in the environment;
    otherwise fails with `P1012`/"Environment variable not found" — an environment artifact, not
    a schema problem).
  - `npx vitest run` — **73 test files passed, 1 skipped (74 total); 460 tests passed, 6 skipped
    (466 total); 0 failed.**

---

## 2. Architecture Overview

### Clean Architecture layers (per module)
```
interface/http   →   application   →   domain
                          ↑
                   infrastructure (implements application's port interfaces)
```
- `domain/` — entities, value objects. Framework-free: no Prisma, no Express, no HTTP imports.
- `application/` — use cases, DTOs, port interfaces (`I*Repository`), typed `DomainError` subclasses.
- `infrastructure/` — Prisma repository implementations, adapters implementing the ports.
- `interface/http/` — Express controllers, routers, Zod schemas, presenters. **Only exists for
  `identity`, `borrower`, `loan-product`, `loan-account`, `ledger`, `repayment`** — `document`
  and `audit` remain empty `.gitkeep` scaffolds.

### Module structure (`app/backend/src/modules/`)
| Module | Status |
|---|---|
| `identity` | Fully built (Milestone 6): login, refresh rotation, logout, get-current-user. |
| `borrower` | Fully built through HTTP (Milestone 7 + 8): `Borrower`, `CoBorrower` aggregates. |
| `loan-product` | Fully built through HTTP: `LoanProduct` aggregate owning `LoanProductVersion[]` (+ `PenaltyRule`, `FeeRule`). |
| `loan-account` | Fully built through HTTP: `LoanAccount` aggregate owning `AppliedFee[]`. |
| `ledger` | Fully built, **HTTP is read-only** (D-2): `LoanTransaction`, independent append-only aggregate. |
| `repayment` | Fully built, **HTTP is read-only** (D-2): `RepaymentInstallment`, independent aggregate. |
| `document` | Scaffolded only (`.gitkeep`), not started. |
| `audit` | Scaffolded only (`.gitkeep`), not started. |

### Shared infrastructure (`app/backend/src/shared/`)
| Path | Purpose |
|---|---|
| `domain/Money.ts`, `domain/Percentage.ts` | Value objects wrapping `decimal.js`'s `Decimal` directly (imported from `decimal.js`, not `@prisma/client` — a database-portability refactor, uncommitted) — never native `number`. Deterministic, pure methods; construction throws `InvalidMoneyError`/`InvalidPercentageError`. **Final decision: no `Result<T,E>` for these.** |
| `domain/errors/FinancialDomainErrors.ts` | `InvalidMoneyError`, `InvalidPercentageError`. |
| `application/ports/IUnitOfWork.ts`, `application/TransactionContext.ts` | Framework-free cross-module transaction-boundary port. |
| `infrastructure/PrismaUnitOfWork.ts` | Implements `IUnitOfWork` via `prisma.$transaction`; exports `resolveClient(ctx)` and `withTransaction(ctx, work)` — the standard self-wrapping pattern every multi-statement repository write now uses. |
| `database/prismaClient.ts` | Singleton `PrismaClient`. |
| `errors/DomainError.ts` | Base class + `NotFoundError`, `ValidationError`, `ForbiddenError` (403, added Milestone 8). |
| `middleware/errorHandler.ts` | Central Express error handler — maps any `DomainError` to `{ error: { code, message, ruleId } } ` + its `httpStatus`; anything else → generic 500. **Does not special-case Prisma or decimal.js errors** (tracked gap, see §5). |
| `middleware/requireAuth.ts` | JWT verification middleware + `getCurrentUser(req)` helper. |
| `middleware/requireRole.ts` | Milestone 8 / ADR-043 — minimal role gate, see §6. |
| `middleware/validate.ts` | Generic Zod body validator. |
| `http/pagination.ts` | `parsePaginationParams()`/`toPaginatedResponse()` — cursor pagination (`limit`+`cursor`→`{items, nextCursor}`), no search/filter/sort (D-4). |
| `http/decimalValidation.ts` | Milestone 8.1 / H-2 — `decimalStringSchema`, regex-validated Zod string for every Money/Percentage-bound request field. |
| `http/branchScope.ts` | Milestone 8.1 / H-1 — `resolveBranchScope()`, `assertBranchAccess()`, `resolveBranchFilter()`, `resolveWriteBranchId()`. See §6. |
| `logger/logger.ts` | `pino` structured logger. |
| `result.ts` | `Result<T,E>` — defined, still unused anywhere (deliberate — Money doesn't use it, per Milestone 7 design review). |

### Dependency rules (mechanically enforced)
- ESLint `no-restricted-imports` rule blocks `domain/`, `application/` (in every module) **and**
  `shared/domain/`, `shared/application/` from importing anything under `**/infrastructure/*` or
  `**/interface/*`.
- **As of a database-portability refactor (uncommitted), also mechanically enforced:** `domain/`
  and `application/` (every module, plus `shared/domain/`/`shared/application/`) may not import
  `@prisma/client` at all. `Money`/`Percentage`/`AmortizationScheduleGenerator` were the only
  offenders (they used `Prisma.Decimal` for arithmetic only, no DB access) and now import
  `decimal.js` directly instead — the domain layer has zero ORM dependency, not just zero
  DB-access dependency.
- Cross-module dependencies at the **application** layer are an established, accepted pattern
  (e.g. `loan-account`'s `CreateLoanAccountUseCase` depends on `loan-product`'s
  `ILoanProductRepository` for D-3's range validation).
- Cross-module dependencies at the **interface** layer are now also an established pattern as of
  Milestone 8.1 (`RepaymentController` depends on `loan-account`'s `GetLoanAccountUseCase` for
  H-1's branch check, since `RepaymentInstallment` has no `branchId` of its own).
- Composition root is `app/backend/src/app.ts` — the only place infrastructure is instantiated
  and wired into use cases. All module routers are mounted there under `/api/v1`.

### Important ADRs currently in effect
| ADR / Doc | Status | Location |
|---|---|---|
| ADR-042 — Aggregate & Transaction Boundaries | Accepted, governs all Milestone 7+ aggregate design | `docs/Architecture/ADR-042-aggregate-boundaries.md` |
| ADR-043 — Interim Role-Based Authorization | Accepted, governs `requireRole` | `docs/Architecture/ADR-043-interim-role-based-authorization.md` |
| `FINANCIAL_INVARIANTS.md` | Living document, non-negotiable financial rules | `docs/Architecture/FINANCIAL_INVARIANTS.md` |
| ADR-038 — Full permission matrix | **Still open**, not resolved by ADR-043 | Not yet written as a file — tracked in this handoff only |
| ADR-007, ADR-009, ADR-010, ADR-032 | **Still open** — see §5/§10 | Referenced in `FINANCIAL_INVARIANTS.md §8` |
| ADR-044 — Separate Customer Identity for Future Public Portal | Accepted (decision-only; no code, schema, or route changes); uncommitted | `docs/Architecture/ADR-044-separate-customer-identity-for-public-portal.md`. Explicitly states it does not affect any Milestone 9.1 checkpoint (§5). |
| ADR-045 — Repayment Schedule Due-Date Generation | **Accepted — Concept 1 (Exact First Repayment Date)**; was CP8's last blocker, now resolved | `docs/Architecture/ADR-045-repayment-schedule-due-date-generation.md`. `LoanAccount` will gain an explicit `firstRepaymentDate` field, captured at origination, used as CP8's schedule-generation anchor — not yet implemented. |

### Architectural decisions made during Milestones 7, 7.1, 8, and 8.1
- **M7:** Aggregate boundaries per ADR-042 (see §8 for the full list). `Money`/`Percentage` value
  objects, deterministic, no `Result<T,E>`. `IUnitOfWork` in `shared/application/` (not any one
  module) because it's a cross-module capability. `ApproveLoanUseCase` is deliberately narrow —
  approval ≠ activation/disbursement (ADR-032). Domain Events deliberately deferred. Optimistic
  concurrency (`version` column) decided but not implemented (no balance-mutating writes exist
  yet to need it).
- **M7.1:** Fixed a real bug (`Money.allocate()` lost a cent on negative amounts — allocate on
  absolute value, reapply sign). Fixed two non-atomic multi-statement repository writes
  (`RepaymentInstallment.saveMany()`, `Borrower`/`CoBorrower` `save()`) via the new
  `withTransaction()` helper. Fixed `LoanProductVersion` encapsulation — it's now fully
  immutable (`withActive()` returns a detached copy instead of mutating in place), closing an
  LPV-2 bypass vulnerability.
- **M8:** ADR-043 (interim `requireRole`, not the full permission matrix). Ledger/repayment
  stay HTTP-read-only (D-2) — their write use cases have zero routes, verified by tests
  asserting the methods don't exist on those controllers. `CreateLoanAccountUseCase` gained
  range validation against the referenced `LoanProductVersion` (D-3). Presenters (D-5) are the
  sole place `Money`/`Percentage`/`Date` get serialized. Cursor pagination only, no search/filter
  (D-4, reduced scope). OpenAPI generation evaluated and deliberately deferred (was optional).
- **M8.1:** Decimal format validation moved to the Zod boundary (H-2). Router-level authorization
  now has regression tests (H-3). Branch-scoped authorization added, deliberately separate from
  role authorization (H-1) — see §6. Several audit findings were reviewed and explicitly
  **deferred**, not fixed — see §4/§5.

---

## 3. Completed Milestones

- **Milestones 1–2 (Architecture & Folder Structure):** Clean Architecture skeleton, npm
  workspaces monorepo, 8 backend module folders scaffolded.
- **Milestone 3 (Project Initialization):** Runnable Express server, strict TypeScript, Zod-
  validated fail-fast env config, secure-by-default middleware baseline, Docker Compose.
- **Milestone 4 (Database Schema):** Full `schema.prisma` — 27 models, 17 enums, every
  model/field traced to a Phase 1.5 rule ID or ADR via `///` doc comments.
- **Milestone 5 (Migrations & Seed):** Initial migration + schema-review follow-up migration
  (16 missing indexes, LPV-2 partial unique index). Seed: one Branch, 6 baseline Roles, starter
  Permissions.
- **Milestone 6 (Authentication):** JWT access tokens + opaque HMAC-hashed refresh tokens with
  atomic rotate-on-use and reuse detection. bcrypt password hashing. 6 audit findings + 1
  production-readiness finding fixed (transactional `rotate()`, `TRUST_PROXY` validation, etc.).
  **Authorization explicitly out of scope** — `requireAuth` only, no role checks.
- **Milestone 7 (Core Domain Models):** Built `domain`/`application`/`infrastructure` for
  `borrower`, `loan-product`, `loan-account`, `ledger`, `repayment` against the existing schema.
  Introduced the shared kernel (`Money`, `Percentage`, `IUnitOfWork`, `PrismaUnitOfWork`).
  Explicitly excluded: interest calculation, amortization, payment allocation, HTTP layer,
  authorization, Domain Events. `docs/Architecture/ADR-042` and `FINANCIAL_INVARIANTS.md`
  written before implementation began.
- **Milestone 7.1 (Audit Remediation):** Fixed C-1 (Money.allocate negative bug), C-2
  (RepaymentInstallment saveMany non-atomic), H-1 (LoanProductVersion encapsulation/LPV-2
  bypass), H-2 (Borrower/CoBorrower repository non-atomic writes). Added `withTransaction()`
  shared helper. All four were **Critical/High** findings from an independent architectural
  audit, verified empirically (not just theorized) before fixing.
- **Milestone 8 (HTTP API Layer):** Exposed the M7 application layer via Express — full CRUD-ish
  surfaces for `borrower`/`loan-product`/`loan-account`, read-only for `ledger`/`repayment`.
  ADR-043 (interim role authorization). D-3 range validation added to loan origination.
  Presenters, pagination, Zod schemas all introduced. `docs/Architecture/ADR-043` written before
  implementation began.
- **Milestone 8.1 (Post-M8 Audit Remediation):** Fixed H-2 (decimal validation), M-5 (missing
  test coverage), H-3 (authorization regression tests), H-1 (branch-scoped authorization) from
  an independent architectural audit of the M8 HTTP layer. Several Medium/Low findings
  deliberately deferred — see §4/§5.

---

## 4. Audit History

### Milestone 7 architectural audit
Independent review of the M7 domain/application/infrastructure layers. Found and the user
approved fixing:
- **C-1 (Critical):** `Money.allocate()` lost a cent on negative amounts — verified empirically
  (`-10.00` split 3 ways summed to `-9.99`, not `-10.00`).
- **C-2 (Critical):** `RepaymentInstallment.saveMany()` issued unwrapped, non-atomic upserts.
- **H-1 (High):** `LoanProductVersion._setActive()` was fully public — any code holding a
  version reference could bypass LPV-2 without going through `LoanProduct.activateVersion()`.
- **H-2 (High):** `PrismaBorrowerRepository`/`PrismaCoBorrowerRepository.save()` were non-atomic
  multi-statement writes, inconsistent with `loan-product`/`loan-account`'s pattern.
- Several Medium/Low findings (e.g. `Money`/`Percentage` importing `@prisma/client` directly,
  mutable plain-interface child records on `Borrower`) were **identified but not approved for
  remediation** — they remain open, see §5.

### Milestone 7.1 remediation
All four Critical/High findings above were fixed, each verified with regression tests that
would have caught the original bug. Full suite grew from 201 to 233... (final M7.1 count was
**201 tests passing** at the very start, growing through the fixes — see commit `c1c38bc` for
the exact before/after). Nothing from Milestone 8 was started during this pass.

### Milestone 8 post-implementation audit
Independent review of the M8 HTTP layer (controllers, routers, schemas, presenters, repository
additions). Findings, categorized:
- **H-1 (High):** No branch-scoped authorization anywhere — any authenticated user could read/
  write data across every branch; `branchId` was a client-trusted, unvalidated write field.
- **H-2 (High):** Decimal-string request fields weren't format-validated — malformed input
  crashed with a raw 500 instead of a clean 400. Verified empirically (`new Prisma.Decimal('abc')`
  throws a plain `Error`, not caught by `errorHandler`'s `DomainError` check).
- **H-3 (High):** Router-level authorization wiring (which middleware guards which route) had
  zero test coverage.
- **M-1 (Medium):** "Mutate, then re-fetch" pattern in 4 controller methods (loan-product
  `createVersion`/`activateVersion`, loan-account `approve`/`reject`) — a race window under
  concurrent requests, plus one avoidable DB round trip.
- **M-2 (Medium):** Library-level errors (Prisma unique-constraint violations, cursor-not-found)
  aren't translated to clean 4xx responses — same root cause as H-2, broader.
- **M-3 (Medium):** Full borrower PII (government ID numbers, birthdate) returned to every
  authenticated role, no field-level redaction.
- **M-4 (Medium):** Presenters have zero dedicated unit tests (only incidental coverage via
  controller tests).
- **M-5 (Medium):** `LoanProductController.list()`/`get()` had no success-path test coverage.
- **L-1 through L-5 (Low):** pagination-heuristic round-trip cost, missing `Location` headers on
  201s, `/repayment-schedule` singular-vs-plural naming inconsistency, untested nested-Zod
  validation failures, list-for-account endpoints not verifying the parent resource exists.

### Milestone 8.1 remediation
**Approved and fixed:** H-1, H-2, H-3, M-5 (see §1 for verification, §6 for H-1's design in
detail).
**Explicitly deferred, not fixed this pass (approved deferral, not an oversight):** M-1, M-2,
M-3, M-4, L-1 through L-5. See §5 for the full list with reasons.

### 2026-07-04 — Repository housekeeping (no code/domain changes)
Three cleanup actions, none affecting business logic, application code, or any ADR's decision
content:
- **New ADR added:** `docs/Architecture/ADR-046-advance-interest-fee-extended-first-repayment-gap.md`
  — documents a previously-unmodeled origination-time fee discovered during legacy-data
  investigation (triggered when `firstRepaymentDate − disbursementDate > 30 days`; rate basis is
  Add-On Rate; rounding is ceiling-to-whole-peso). Does not block Milestone 9.1 CP8. See the ADR
  itself for full evidence trail.
- **Two previously-unnumbered ADRs renamed for consistency with the `ADR-[number]-[slug].md`
  convention used by every other ADR in this repository:**
  - `ADR-financial-audit-isolation.md` → `docs/Architecture/ADR-047-financial-audit-isolation.md`
  - `ADR-optimistic-concurrency.md` → `docs/Architecture/ADR-048-optimistic-concurrency.md`

  Renamed via `git mv` (history preserved). All cross-references updated in
  `ADR-007_DECISION_BRIEF.md`, `CALCULATION_ENGINE_SPEC.md`,
  `MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`, and this file. **No content, decision, or status
  changed in either ADR — this was a filename/reference-only fix.** If any external notes, tickets,
  or chat history reference the old filenames, update them to the new numbered names above.
- **Removed 8 empty, untracked, top-level scaffold folders** left over from initial project setup
  (`backend/`, `database/`, `deployments/`, `frontend/`, `scripts/`, `tests/`, `docs/Reports/`,
  `docs/SRS/`) — all duplicated the already-in-use `app/backend`/`app/frontend` structure, were
  never populated, and were not tracked by git. `legacy/sdevtech/` (referenced as evidence in
  `ADR-045`) and `app/frontend/src/{components,features,hooks,lib,routes}` (intentional, not-yet-
  populated frontend scaffolding) were deliberately left untouched.

**Wording inconsistency surfaced and resolved:** while updating references, §8's Financial audit
infrastructure entry was found to say "fail-closed implementation, logs-but-never-throws on write
failure" — self-contradictory, since fail-closed requires throwing, not catching-and-logging.
Checked directly against `app/backend/src/shared/infrastructure/PrismaFinancialAuditLogger.ts`:
the actual code is correct — it deliberately has no `try/catch`, so a failed `auditLog.create()`
call propagates and rolls back the enclosing `IUnitOfWork` transaction, exactly as
`ADR-047-financial-audit-isolation.md` §1/§3 requires. **Only the doc's wording was wrong; the
implementation was never at fault.** §8's entry has been corrected accordingly. While fixing
cross-references, 8 additional stale mentions of the pre-rename filenames were also found and
fixed in code comments: `IFinancialAuditLogger.ts` (×3), `PrismaFinancialAuditLogger.ts` (×1),
`DomainError.ts` (×1), and three unit test files (`LoanAccount.test.ts`,
`PrismaLoanAccountRepository.test.ts`, `PrismaRepaymentInstallmentRepository.test.ts`,
`RepaymentInstallment.test.ts`, `PrismaFinancialAuditLogger.test.ts`) — all comment-only changes,
no test assertions or logic touched.

**Additional consistency fixes found on a second, broader sweep** (grep restricted to `.ts`/`.md`
initially missed non-`.ts` source files):
- `app/backend/prisma/schema.prisma` — 2 stale `ADR-optimistic-concurrency` comment references
  (on `LoanAccount.version` and `RepaymentInstallment.version`) updated to `ADR-048-...`.
- `app/backend/prisma/migrations/20260703000000_add_optimistic_concurrency_version/migration.sql`
  — 3 stale comment references updated to `ADR-048-...`. **Comments only, no DDL changed** — safe
  because this migration has never been applied against a live database in this project (no live
  Postgres has ever been available here, per this file's own header comment and the repeated note
  elsewhere in this handoff), so there is no applied-migration checksum to conflict with. This is
  a deliberate, confirmed exception to the general rule of never editing migrations after
  authoring — do not treat this as precedent for editing a migration that has actually been run
  against a real database.
- `docs/Architecture/FINANCIAL_INVARIANTS.md` §1 — a forward-looking placeholder reference to a
  not-yet-written `docs/Architecture/ADR-042-repayment-installment-aggregate.md` was stale: that
  content was in fact folded into the already-existing `ADR-042-aggregate-boundaries.md` §7
  ("Why `RepaymentInstallment` is an independent Aggregate Root") when it was written, but the
  invariants doc was never updated to point to it. Fixed to reference the real file/section.
- `app/backend/dist/**/*.js` (compiled build output) also matched the old filenames in a repo-wide
  grep — **left untouched, correctly**: `dist/` is git-ignored, regenerated by `npm run build`, and
  will pick up the corrected source comments on the next build. Never hand-edit generated output.
- Verified as **not** issues, so left alone: `ADR-008`, `ADR-015`, `ADR-038`, `ADR-041` are
  mentioned in several docs without a corresponding file, but every mention consistently and
  correctly labels them "still open" / "not yet written" — these are legitimately reserved,
  not-yet-decided ADR numbers, not broken links.

---

## 5. Remaining Deferred Items

### High priority
*(none — all High findings from both audits have been remediated as of Milestone 8.1)*

### Medium priority
- **M-1 — Mutate-then-refetch race window.** `LoanProductController.createVersion()`/
  `activateVersion()` and `LoanAccountController.approve()`/`reject()` call a void-returning (or,
  for `createVersion`, a discarded-return-value) use case, then re-fetch to build the response.
  Under concurrent requests, the response could reflect a different simultaneous change. Fix
  requires changing 4 use cases' return types from `void` to the mutated aggregate — deferred
  because it touches Milestone 7 use-case signatures, which Milestone 8.1 was told to avoid
  ("return-aggregate-refactoring" was explicitly excluded from approved scope).
- **M-2 — Prisma/decimal.js exception translation.** Beyond H-2's Zod-boundary fix, raw library
  errors (Prisma `P2002` unique-constraint violations on duplicate `loanCode`/product `code`;
  Prisma `P2025` on a stale/bogus pagination cursor) still reach `errorHandler`'s generic 500
  branch instead of a clean 409/400. Deferred — explicitly excluded from M8.1 approved scope
  ("Prisma exception translation" was listed as not-to-implement).
- **M-3 — Field-level PII exposure.** `GET /borrowers/:id` returns government ID numbers,
  birthdate, full contact info to **any** authenticated role (Viewer, Cashier, etc.), not just
  origination/compliance-relevant roles. Deferred — tied to the still-open ADR-038 permission
  design; M8.1 was explicitly told not to implement "field-level authorization" or "PII
  masking." Tracked as a required input to ADR-038, not a generic "someday" item.
- **M-4 — No dedicated presenter unit tests.** `presentBorrower`, `presentLoanAccount`, etc. are
  only exercised incidentally via controller tests with "happy path" fixtures — edge cases
  (all-null optional fields, empty collections) are unverified. Deferred — explicitly excluded
  from M8.1 approved scope ("presenter redesign" was listed as not-to-implement; adding tests
  without redesigning was still out of the approved finding list).

### Low priority
- **L-1** — `toPaginatedResponse`'s "full page ⇒ set nextCursor" heuristic always costs one
  extra round trip to confirm the true last page. Standard, accepted cursor-pagination
  trade-off, not really a defect.
- **L-2** — No `Location` header on any `201 Created` response.
- **L-3** — `/loan-accounts/:id/repayment-schedule` breaks the otherwise-consistent plural-
  collection route naming (`/borrowers`, `/transactions`, etc.).
- **L-4** — Nested Zod object validation failures (e.g. malformed `penaltyRule` sub-object) are
  untested (the happy path is tested).
- **L-5** — `GET /loan-accounts/:id/transactions` for a nonexistent `loanAccountId` returns
  `200 { items: [], nextCursor: null }` instead of `404` — inconsistent with `GET /loan-accounts/:id`,
  which correctly 404s for the same nonexistent id.

### Pre-existing, tracked since Milestone 7 (not from either HTTP-layer audit)
- **ADR-007** (outstanding balance formula), **ADR-009** (repayment allocation order),
  **ADR-010** (Add-On vs. Contractual interest disclosure), **ADR-032** (Loan Release vs.
  Disbursement — currently a *working assumption*, not resolved) — all still open, all block the
  future calculation engine.
- **ADR-038** (full permission matrix) — still open; ADR-043 is explicitly interim.
- No live PostgreSQL has ever been available in this dev environment — every DB-dependent claim
  is verified via `tsc`, mocked-Prisma unit tests, and (for the one new case in H-3) mocked
  `supertest` requests — never against a real database. This remains the single largest
  outstanding verification gap across the whole project.
- No `audit` module exists yet — no financial-write use case (create borrower/loan, approve,
  reject, activate version) writes an `AuditLog` entry. `FINANCIAL_INVARIANTS.md §4`'s
  fail-closed, same-transaction audit-write rule is documented but has nothing to apply to yet.

---

## 6. Current Authorization Model

Two **deliberately separate** mechanisms — this separation is a explicit architectural decision
(H-1's requirement was "treat branch authorization separately from role authorization").

### `requireAuth` (`shared/middleware/requireAuth.ts`, Milestone 6)
Verifies the JWT access token (HS256, algorithm pinned), attaches the decoded claims to
`req.authUser: AccessTokenClaims` (`{ sub, email, roles: string[], branchId, jti }`). Rejects
with `UnauthorizedError` (401) if missing/invalid/expired. Every protected route uses this.

### `requireRole` (`shared/middleware/requireRole.ts`, Milestone 8 / ADR-043)
Checks `req.authUser.roles` against a hard-coded, **route-declared** allow-list (e.g.
`requireRole('Administrator', 'Manager')`). Must run **after** `requireAuth` in the middleware
chain. Rejects with `ForbiddenError` (403) if the user has none of the allowed roles.
**Explicitly NOT** a permission matrix: no database lookup against the existing
`Permission`/`RolePermission` tables (which remain unused by application code), no dynamic
configurability, no per-resource granularity. Per-module allow-lists (documented as unverified
assumptions, not sourced from `PROJECT_RULES.md`):
- `borrower`/`loan-account` origination: `['Administrator', 'Manager', 'Loan Officer']`.
- `loan-product` configuration, `loan-account` approve/reject: `['Administrator', 'Manager']`
  (Loan Officer excluded from approval — a separation-of-duties assumption).
- All `GET` routes: `requireAuth` only, no role restriction.

### `branchScope` (`shared/http/branchScope.ts`, Milestone 8.1 / H-1)
- `resolveBranchScope(req)` → `{ branchId, isGlobal }`, reading `req.authUser`.
- `GLOBAL_ROLES = ['Administrator']` — the **only** hard-coded assumption defining who sees
  every branch versus just their own. **Not sourced from `PROJECT_RULES.md`** — flagged for
  confirmation.
- `assertBranchAccess(scope, resourceBranchId)` — throws `ForbiddenError` (403) if a non-global
  caller's branch doesn't match the resource's branch. Used as a post-fetch check on every
  single-resource `GET`, and (for `loan-account`) **before** `approve()`/`reject()` mutate.
- `resolveBranchFilter(scope)` — returns `undefined` (no filter, global) or the caller's own
  `branchId` (scoped) — used to filter list queries at the repository level, so pagination stays
  correct.
- `resolveWriteBranchId(scope, requestedBranchId)` — a non-global caller's own branch always
  wins over whatever the client put in the request body; a global caller's requested value is
  trusted as-is.
- **Applied to:** `borrower` (full), `loan-account` (full, including approve/reject pre-checks),
  `ledger` (`LoanTransaction` has its own `branchId`). **NOT applied to `loan-product`**
  (no `branchId` field exists — products are company-wide, not branch-owned — deliberate
  carve-out). **Applied indirectly to `repayment`** — `RepaymentInstallment` has no `branchId` of
  its own, so `RepaymentController` fetches the parent `LoanAccount` (via a new
  `getLoanAccountUseCase` dependency) and checks *its* branch instead — one extra DB round trip,
  an accepted trade-off.

### Known limitations
- `GLOBAL_ROLES` is a single hard-coded array, same "minimal/interim" status as `requireRole`'s
  allow-lists — not configurable, not database-backed.
- No field-level authorization exists (M-3, deferred) — a Viewer sees the exact same borrower
  fields as an Administrator, just gated to their own branch now.
- `Permission`/`RolePermission` tables remain completely unused by application code.

### Relationship to ADR-038 and ADR-043
ADR-043 documents that `requireRole` is explicitly interim, pending ADR-038's full permission-
matrix design (still unwritten as a file). `branchScope`'s `GLOBAL_ROLES` list is the same kind
of interim mechanism, introduced in Milestone 8.1 without its own dedicated ADR (it's documented
in this handoff and in commit `2f3ad3b`'s message, not in a standalone ADR file — worth
formalizing into ADR-038's eventual scope, along with M-3's field-level redaction question).

---

## 7. Testing Status

### Philosophy (established Milestone 6, held consistently since)
- **Unit tests are the primary, always-running layer.** Nothing in the unit suite requires a
  live database. Repositories are tested against a mocked `PrismaClient`; use cases are tested
  against mocked repository ports; **controllers are tested by calling their methods directly
  with mock `req`/`res`/`next`** — no Express, no `supertest`, no DB (established as the
  standard pattern in Milestone 8).
- **Integration tests are opt-in** (`RUN_INTEGRATION_TESTS=1`), live in `tests/integration/`,
  require a real Postgres, and always skip in this dev environment. Only `identity` has one so
  far (`auth.test.ts`) — no module built since Milestone 7 has an integration test yet.

### Important regression tests to know about
- `tests/unit/shared/Money.test.ts` — includes the C-1 regression suite (negative-amount
  allocation, mirrors the positive-amount split exactly).
- `tests/unit/repayment/PrismaRepaymentInstallmentRepository.test.ts`,
  `tests/unit/borrower/PrismaBorrowerRepository.test.ts`,
  `tests/unit/borrower/PrismaCoBorrowerRepository.test.ts` — assert `$transaction` is actually
  called for multi-statement writes (the C-2/H-2-from-M7.1 regression tests).
- `tests/unit/loan-product/LoanProduct.test.ts` — has a dedicated `describe` block proving the
  M7.1 H-1 fix: calling `withActive()` on an externally-held `LoanProductVersion` reference has
  zero effect on the aggregate, and `LoanProduct.versions` returns a defensive copy.
- `tests/unit/shared/decimalValidation.test.ts` and the `describe('decimal field format
  validation (H-2)')` blocks in `loanProductSchemas.test.ts`/`loanAccountSchemas.test.ts` — the
  M8.1 H-2 regression tests.
- **`tests/unit/authorization.test.ts`** — the M8.1 H-3 regression suite. Hits `createApp()` via
  `supertest` for the 4 highest-risk routes, asserting 401/403/passes-gate. **Prisma is mocked
  in this file** (not a live DB) so it runs deterministically in well under a second — this is
  the pattern to copy for any future router-level authorization test.
- `tests/unit/shared/branchScope.test.ts` plus the `describe('branch scoping (H-1)')` blocks in
  every affected controller/use-case/repository test file — the M8.1 H-1 regression tests.

### Mocked Prisma strategy
Every repository test file does `vi.mock('@shared/database/prismaClient', () => ({ prisma:
prismaMock }))` before a dynamic `await import(...)` of the module under test, with
`prismaMock.$transaction` typically implemented as `vi.fn(async (callback) => callback(prismaMock))`
so `withTransaction()`/`resolveClient()` resolve against the same mock object. Use
`vi.resetAllMocks()` (not `vi.clearAllMocks()`) in `beforeEach` whenever any test in the file sets
a `mockRejectedValue`/`mockResolvedValueOnce` — `clearAllMocks` only resets call history, not
implementation overrides, which caused a real test-pollution bug once during Milestone 7.1
(see `PrismaBorrowerRepository.test.ts`'s `beforeEach` comment for the full explanation).

### Current passing test count
**353 passing, 0 failing, 6 correctly skipped** (verified fresh at the start of this document).

---

## 8. Repository State

### New repositories/use cases/controllers/routes added (Milestones 7 → 8.1, cumulative)
- **Repositories:** `PrismaBorrowerRepository`, `PrismaCoBorrowerRepository`,
  `PrismaLoanProductRepository`, `PrismaLoanAccountRepository`,
  `PrismaLoanTransactionRepository`, `PrismaRepaymentInstallmentRepository` — each with
  `findById`/`findMany` (or `findByLoanAccountId`)/`save` (or `create`), all accepting an
  optional `TransactionContext`.
- **Use cases (representative, not exhaustive):** Create/Get/List per module, plus
  `ApproveLoanUseCase`/`RejectLoanUseCase`, `ActivateLoanProductVersionUseCase`,
  `CreateLoanProductVersionUseCase`, `GetLoanTransactionUseCase`,
  `GetRepaymentInstallmentUseCase`. **Deliberately NOT exposed via HTTP:**
  `RecordLoanTransactionUseCase`, `CreateRepaymentInstallmentUseCase`,
  `RecordInstallmentPaymentUseCase` — these remain callable only from within the application
  layer, with zero routes (D-2).
- **Controllers/routers:** one pair per HTTP-exposed module (`borrowerController.ts`/
  `borrowerRouter.ts`, etc.), all following the exact shape established by `identity`'s
  `AuthController`/`authRouter` in Milestone 6 — thin, `try/catch { next(error) }`, no business
  logic.

### Shared helpers
`shared/http/pagination.ts`, `shared/http/decimalValidation.ts`, `shared/http/branchScope.ts`,
`shared/infrastructure/PrismaUnitOfWork.ts` (`resolveClient`, `withTransaction`) — see §2 table
for details.

### Presenters
One `presenters/<Entity>Presenter.ts` per HTTP-exposed module — the **only** place `Money`/
`Percentage` become strings (`.toString()`) and `Date` becomes ISO strings (`.toISOString()`).
Controllers never call these formatting methods directly (enforced by convention + controller
tests asserting response field types, not by a lint rule).

### Pagination
Cursor-based (`limit` + `cursor` → `{ items, nextCursor }`), consistent across `borrower`,
`loan-product`, `loan-account`, `ledger`. `repayment`'s list is genuinely unpaginated by design
(ADR-042 §7/§11 — a schedule is bounded, low-hundreds-per-loan at most) but still returns the
same `{ items, nextCursor: null }` shape for response consistency.

### Validation
Zod at the `interface/http` boundary only — shape/type/format validation (including, as of
Milestone 8.1, decimal-string format via `decimalStringSchema`). Business-rule validation (e.g.
non-blank names, LPV-2, range checks) stays in the domain/application layers.

### Branch scoping
See §6 in full.

### Transaction helpers
`IUnitOfWork`/`PrismaUnitOfWork` (Milestone 7) for explicit multi-aggregate transactions (not yet
used by any real use case — no multi-aggregate write exists yet). `withTransaction(ctx, work)`
(Milestone 7.1) is the simpler, more commonly used helper — self-wraps a repository's own
multi-statement write in `prisma.$transaction` when no outer `ctx` is supplied, or joins the
caller's transaction when one is. Used by `PrismaLoanProductRepository`,
`PrismaLoanAccountRepository`, `PrismaBorrowerRepository`, `PrismaCoBorrowerRepository`,
`PrismaRepaymentInstallmentRepository.saveMany()`.

### Immutable domain changes
`LoanProductVersion` (Milestone 7.1, H-1) is now fully immutable — `readonly props`, no in-place
mutators. `withActive(isActive)` returns a **new, detached** instance; `LoanProduct.
activateVersion()` replaces `versions[]` entries via `.map()` rather than mutating in place.
`LoanProduct.versions` getter returns a defensive array copy. This is the only entity whose
mutability model changed after its original Milestone 7 design.

### Financial invariants
Governed by `docs/Architecture/FINANCIAL_INVARIANTS.md` (living document) — money/percentage
precision rules, LPV-2, balance-integrity rules, the fail-closed audit-write rule (not yet wired
to any code — no `audit` module exists), rounding rules, the (decided-but-not-implemented)
optimistic-concurrency strategy, and the open-ADR list. **Read this file before touching anything
that computes or stores a monetary value.**

---

## 9. Important Project Rules

### From `CLAUDE.md`
- Clean Architecture, SOLID, DRY, KISS, Repository Pattern, DTO Pattern, DI, modular design.
  Business logic never in controllers.
- Financial calculations must prioritize correctness over convenience; every approved loan keeps
  an immutable snapshot of the rules used at approval; editing a product must never affect
  historical loans (LPV-1/LPV-3, already enforced).
- Never invent business rules; when uncertain, ask or explicitly mark an assumption. Every
  interim/unverified assumption in this codebase (role allow-lists, `GLOBAL_ROLES`, separation-
  of-duties on approval) is documented inline and in this handoff — keep that discipline.
- Security: JWT auth (done), RBAC (interim, see §6), input validation (Zod, done), rate limiting
  (done), Helmet/CORS (done), audit logging (**not yet implemented** — no `audit` module).
- Documentation is part of the deliverable — update it whenever architecture or code changes.
- Development workflow: analyze → design → explain reasoning → implement → test → update docs →
  **wait for approval** before the next milestone. This has been followed strictly through
  Milestone 8.1 — do not start Milestone 9 without explicit approval.
- Git: focused commits, recommend messages at milestones, never rewrite history without
  explicit instruction.

### From `PROJECT_RULES.md`
- Priority order when rules conflict: verified production data > official policy > approved
  management decisions > legacy behavior > explicitly marked assumptions.
- Multi-branch is a first-class requirement (§Branch Operations) — this is *why* H-1 (branch
  scoping) was treated as a real, current-state gap rather than a future nice-to-have.
- Loan product versioning, interest methods, penalties, fees, audit trail, borrower/co-borrower/
  guarantor structure — all as already reflected in the Prisma schema and M7's domain model.
- Global search (§Search) — **not yet built**, explicitly deferred past Milestone 8 (D-4 reduced
  list endpoints to cursor pagination only, no search/filter/sort).

### From this `PROJECT_HANDOFF.md` (self-referential — keep following)
- Every milestone's scope boundary (what was explicitly NOT built) is intentional, not an
  oversight — check §5 and the relevant milestone's "deliberately not built" notes before
  assuming something is missing by accident.
- Documented assumptions (role lists, `GLOBAL_ROLES`, separation-of-duties) are marked as
  **unverified** against `PROJECT_RULES.md` — do not treat them as confirmed business rules if a
  future milestone needs to rely on them for something higher-stakes.

---

## 10. Milestone 9 Readiness and Implementation Progress

**Update (2026-07-03, mid-implementation, through CP7):** the authoritative implementation plan
remains `docs/Architecture/MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md` — read that document, not any
roadmap described in prior conversation history, before continuing Milestone 9.1 implementation.
Its central correction (still valid, unchanged by implementation so far): `ADR-007` §3
(penalty-inclusion in `outstandingBalance`) blocks only the narrow CP11 "summary getter"
checkpoint; CP1–CP10 require no business decision. No ADR has been changed by implementation work
so far — see the v2 roadmap's own "Preserved ADRs" section. ADR-044 (new since CP5, decision-only)
does not add, remove, or reorder any checkpoint either — confirmed by its own §5.

### 10.0 Milestone 9.1 checkpoint status (verified directly against the repository, 2026-07-03)

| Checkpoint | Status | Evidence |
|---|---|---|
| CP1 — Concurrency infrastructure | **Done, committed** (`bdaa7b6`) | `version` columns added to `LoanAccount`/`RepaymentInstallment` in `schema.prisma`; `ConcurrencyConflictError` added to `shared/errors/DomainError.ts`. |
| CP2 — Financial audit infrastructure | **Done, committed** (`363ffde`) | `shared/application/ports/IFinancialAuditLogger.ts` (port) + `shared/infrastructure/PrismaFinancialAuditLogger.ts` (fail-closed implementation — deliberately does NOT catch its own errors, so a write failure throws/propagates and rolls back the enclosing transaction, per `ADR-047-financial-audit-isolation.md`). |
| CP3 — Declining-balance interest + PMT amortization | **Done, committed** (`f964a63`) | `shared/domain/calculation/DecliningBalanceInterestCalculator.ts`, `AmortizationScheduleGenerator.ts` (CALC-SPEC §1/§2). Standalone, not yet called by any use case. |
| CP4 — Payment allocation calculator + service | **Done, committed** (`ec681fe`) | `shared/domain/calculation/PaymentAllocationCalculator.ts`, `PaymentAllocationService.ts` (CALC-SPEC §5, ADR-009). Standalone, not yet called by any use case. |
| CP5 — `version` property on domain model | **Done, committed** (`f57efc3`) | `LoanAccount`/`RepaymentInstallment` domain entities expose `version` via getter; `PrismaLoanAccountRepository`/`PrismaRepaymentInstallmentRepository` map the column through on read. |
| CP6 — Repository conditional-write refactor | **Done, implemented and verified, not yet committed** | Verified by inspection: `PrismaLoanAccountRepository.ts`/`PrismaRepaymentInstallmentRepository.ts` no longer call unconditional `upsert()` — an explicit `create()` (new aggregates) or a conditional `updateMany({ where: { id, version }, data: { ..., version: { increment: 1 } } })` (existing aggregates), throwing `ConcurrencyConflictError` on a zero-row result. Preceded by regression coverage of the pre-existing `AppliedFee`/co-borrower/`saveMany` atomicity behavior, confirmed unchanged. |
| CP7 — `LoanAccount` balance-mutation domain methods (`activate()`, `applyPayment()`) | **Done, implemented and verified, not yet committed** | Both methods exist on `LoanAccount` (`src/modules/loan-account/domain/LoanAccount.ts`), accepting already-decided totals/splits (no calculation performed inside the aggregate), reusing `transitionTo()` and the `ledger` module's `TransactionComponents` VO per Decision Log #13/#14. Neither writes to the ledger or any repository — per `FINANCIAL_INVARIANTS.md §3`, that obligation belongs to the not-yet-built CP8/CP9 use cases. |
| CP8 — `ActivateLoanUseCase` | **Not started, fully unblocked** | No such file exists yet. Depends on CP7 (done). Its checklist items: (1) verify `LoanProductVersion` exposes `roundingMethod`/`daysInYearConvention`/`repaymentPeriodUnit` (Decision Log #4) — not yet performed; (2) `ADR-045` (repayment schedule due-date generation) — **Accepted, Concept 1 (Exact First Repayment Date)** — schedule generation will use a new `LoanAccount.firstRepaymentDate` field, supplied at origination, as the schedule anchor. This was the last blocker; CP8 is no longer gated on any open business decision. |
| CP9 — `ProcessPaymentUseCase` | **Not started** | Depends on CP4 (done)/CP7 (done). |
| CP10 — Golden-master replay tests | **Not started** | Depends on CP8/CP9. |
| CP11 (gated on ADR-007 §3) — `outstandingBalance` summary getter | **Not started, gated** | ADR-007 §3 remains UNRESOLVED (verified: `ADR-007-outstanding-balance-formula.md` §3 still reads "STATUS: UNRESOLVED — requires your decision"). |
| CP12 (gated on ADR-007 §4) — Legacy migration treatment | **Not started, gated** | ADR-007 §4 remains UNRESOLVED (same file, §4). |
| CP13 (deferred, future milestone) — HTTP exposure | **Not started, deliberately deferred** | Per D-2 precedent — no route until a real, correctness-gated caller (CP8/CP9) exists. |

**Next authoritative checkpoint: CP8 (`ActivateLoanUseCase`).** It is next in the roadmap's
recommended sequential order, its only dependency (CP7) is done, and its former business blocker
(`ADR-045`) is now resolved (Accepted, Concept 1 — Exact First Repayment Date; see
`docs/Architecture/ADR-045-repayment-schedule-due-date-generation.md` §5–§6). Per the roadmap's
CP8 description, implementation must begin with an explicit first step verifying the existing
`LoanProductVersion` domain entity already exposes `roundingMethod`/`daysInYearConvention`/
`repaymentPeriodUnit` (Decision Log #4), and must add `LoanAccount.firstRepaymentDate` (captured at
origination) as the schedule's anchor per `ADR-045`. **Do not start CP8 without explicit approval;
this handoff does not constitute that approval.**

### 10.0.1 New/modified source files added by CP1–CP7 (for orientation, not exhaustive)
- `app/backend/src/shared/errors/DomainError.ts` — `ConcurrencyConflictError` (CP1).
- `app/backend/src/shared/application/ports/IFinancialAuditLogger.ts` — port (CP2).
- `app/backend/src/shared/infrastructure/PrismaFinancialAuditLogger.ts` — implementation (CP2).
- `app/backend/src/shared/domain/calculation/DecliningBalanceInterestCalculator.ts` (CP3).
- `app/backend/src/shared/domain/calculation/AmortizationScheduleGenerator.ts` (CP3).
- `app/backend/src/shared/domain/calculation/PaymentAllocationCalculator.ts` (CP4).
- `app/backend/src/shared/domain/calculation/PaymentAllocationService.ts` (CP4).
- `app/backend/src/shared/domain/calculation/errors/CalculationDomainErrors.ts` (CP3/CP4).
- `LoanAccount.version` / `RepaymentInstallment.version` getters (CP5), in
  `src/modules/loan-account/domain/LoanAccount.ts` and
  `src/modules/repayment/domain/RepaymentInstallment.ts`.
- `LoanAccount.isNew` / `RepaymentInstallment.isNew` getters (CP6, same two files) — lets the
  repository route between INSERT and conditional UPDATE without an extra read.
- `PrismaLoanAccountRepository.ts`'s `writeGraph()` and `PrismaRepaymentInstallmentRepository.ts`'s
  new `persistInstallment()` helper (CP6) — the conditional create/update split.
- `LoanAccount.activate(input)` / `LoanAccount.applyPayment(components, paidAt?)` and the new
  `ActivateLoanAccountInput` interface (CP7), all in
  `src/modules/loan-account/domain/LoanAccount.ts`.
- Corresponding test files under `tests/unit/shared/`, `tests/unit/shared/calculation/`,
  `tests/unit/loan-account/`, `tests/unit/repayment/` (77 new tests total across CP1–CP7: 56 from
  CP1–CP5, +11 from CP6, +10 from CP7).
- **Not part of any checkpoint** but present in the same uncommitted working tree: a
  database-portability refactor (`Money.ts`, `Percentage.ts`, `AmortizationScheduleGenerator.ts`,
  `.eslintrc.json`, `package.json`/`package-lock.json`) and
  `docs/Architecture/ADR-044-separate-customer-identity-for-public-portal.md` — see this session's
  commit-classification report for the exact file-to-commit mapping.

### 10.1 New documentation created this phase

**Legacy evidence analysis** (four investigation passes, all in one living document):
- `docs/Legacy Analysis/2026-07-03-milestone9-financial-rules-verification.md` — ~1,340 lines.
  Read this document in full before touching any financial calculation code; it is the evidence
  base every ADR below cites. Its methodology: direct, read-only inspection of
  `legacy/mongodb/07012026_103239/db-easycash/` (a real MongoDB dump — `loan_accounts`,
  `loan_transactions` [524,463 records, full population scans performed multiple times],
  `repayments`, `loan_products`, `disbursements`, and others), `legacy/reports/*.xlsx` (six Excel
  exports), and `legacy/reports/201 Loan Docs Generator/` (a live Excel computation workbook with
  ~200 named formula ranges, plus the company's actual legal document templates — Disclosure
  Statement, Promissory Note, Loan Agreement — read via a throwaway Node.js BSON/XLSX-parsing
  script kept in the session scratchpad, never committed to this repository).

**Six new Architecture documents** (all under `docs/Architecture/`, all created this phase, all
citing the Legacy Analysis document by section):
1. `ADR-032-loan-release-vs-disbursement.md` — **Accepted.**
2. `ADR-010-addon-vs-contractual-interest.md` — **Accepted**, with two named open sub-questions.
3. `ADR-009-payment-allocation-order.md` — **Accepted**, with several named open sub-questions.
4. `ADR-007-outstanding-balance-formula.md` — **PARTIALLY ACCEPTED** — the balance-tracking
   *mechanism* is decided; two central design questions are explicitly left `UNRESOLVED`,
   deliberately, per instruction not to invent a resolution to a genuine contradiction in the
   evidence. **This ADR needs your decision before it can be marked fully Accepted.**
5. `ADR-047-financial-audit-isolation.md` — **Accepted.** Formalizes a principle already agreed in
   `FINANCIAL_INVARIANTS.md §4`; introduces no new decision.
6. `ADR-048-optimistic-concurrency.md` — **Accepted.** Formalizes a principle already agreed in
   `FINANCIAL_INVARIANTS.md §6`; introduces no new decision.

**One new specification document:**
7. `CALCULATION_ENGINE_SPEC.md` — the single source of truth for every financial calculation.
   Covers 12 calculations; 7 are `CONFIRMED` or `CONFIRMED` with a narrow open sub-point (ready to
   implement), 5 are explicitly `STATUS: UNRESOLVED` (Flat-Rate Interest, Overpayment Handling,
   Penalty Calculation, the exact timing mechanics of Maturity Capitalization, and the
   Reversal/Adjustment data-modeling question) — **do not implement these five from general
   lending convention; each states exactly what evidence would resolve it.**

**None of these seven documents have been committed to git as of this writing** — they exist as
new, uncommitted files. Confirm with the user before committing, per this project's git workflow
discipline.

### 10.2 Evidence-gathering summary

Four investigation passes, each documented as its own section of the Legacy Analysis document:
1. **Initial pass** (§1–§6): baseline evidence for all four original open ADRs, using the MongoDB
   dump and Excel reports already present in the repo.
2. **Follow-up pass** (§7): full-population (not sampled) categorization of the 79 non-reconciling
   `CLOSED` legacy loans, resolution of why two legacy reports define "total balance"
   differently, and additional payment-allocation/reversal/overpayment evidence.
3. **"201 Loan Docs Generator" pass** (§8): discovery and full formula-level analysis of a live
   Excel computation workbook and the company's actual legal document templates — the single
   richest evidence source found, substantially resolving ADR-010 and materially strengthening
   ADR-009.
4. **`DECLINING_BALANCE_DISCOUNTED` resolution pass** (§9): full-population (all 835 loans, not a
   sample) classification resolving a discrepancy between the workbook's modeled behavior and
   real transaction data — concluded it is a naming inconsistency (rate-origin vs. cash-flow-
   timing), not a bug, and that both `DECLINING_BALANCE` and `DECLINING_BALANCE_DISCOUNTED`
   require the identical calculation algorithm.

### 10.3 ADR status (authoritative as of this handoff)

| ADR | Status | What's left, if anything |
|---|---|---|
| ADR-032 (release vs. disbursement) | **Accepted** | Nothing — ready for `ActivateLoanUseCase` design to reference |
| ADR-010 (Add-On vs. Contractual) | **Accepted**, with 2 open sub-questions | Whether an IRR/EIR concept is needed at all (no evidence of operational use); the 37.2% rate-tier residual not covered by the known lookup table |
| ADR-009 (payment allocation order) | **Accepted**, with several open sub-questions | Fees-first tier is contractually confirmed but transactionally unverified; capitalization timing mechanics; reversal-convention unification; adjustment-type granularity; manual fee/penalty-only payment channel; whether allocation order is configurable per product |
| ADR-007 (outstanding balance formula) | **PARTIALLY ACCEPTED — needs your decision** | Whether `outstandingBalance` includes penalty (two real, both-legitimate legacy concepts found) or needs two distinct fields; how to treat the 15.5% non-reconciling `CLOSED` legacy population during migration |
| Financial Audit Isolation | **Accepted** | Nothing — implementation (Milestone 9.1) still pending |
| Optimistic Concurrency | **Accepted** | Nothing — implementation (Milestone 9.1) still pending |

### 10.4 Remaining unresolved items (do not resolve by inference)

From `CALCULATION_ENGINE_SPEC.md`, explicitly blocked pending evidence or a business decision:
- **Flat-Rate interest formula** — no legacy evidence found anywhere examined.
- **Overpayment recording mechanism** — zero examples found across all 524,463 legacy
  transactions searched.
- **Penalty calculation formula** — the daily `PENALTY_APPLIED` cadence and `PERCENTAGE_PER_DAY`/
  `penalty_rate` fields are observed, but no formula connecting them to real posted amounts was
  verified; also gated by the still-open ADR-008 (penalty cap policy), not produced this
  milestone.
- **Maturity-capitalization timing** — contractually confirmed as a rule, but *when* exactly it
  triggers (original scheduled maturity only? every subsequent arrears cycle?) has no evidence.
- **Reversal/adjustment data modeling** — two non-uniform legacy conventions coexist; which (or
  both) the new schema should support is a design question, not a data question.

From ADR-007 specifically: the penalty-inclusion question and the 15.5%/79-loan legacy
reconciliation-gap question are **explicit decisions for you**, not further data-mining targets —
the Legacy Analysis document (§7.3, §7.4) and ADR-007 (§3, §4) lay out the evidence and options
for each without selecting one.

### 10.5 Prerequisites already completed (unchanged from before this phase)
Full HTTP CRUD-ish surface for `borrower`/`loan-product`/`loan-account`; read-only surfaces for
`ledger`/`repayment`; interim authorization (role + branch); `Money`/`Percentage` value objects
ready for calculation-engine use; `IUnitOfWork` ready for the first real multi-aggregate
transaction. **New this phase:** the actual formulas, allocation order, and lifecycle model that
calculation-engine code will implement are now documented and evidence-cited, not merely assumed.

### 10.6 Risks

- **ADR-007 is a hard blocker for any balance-mutating write** — `ActivateLoanUseCase` and any
  payment-recording use case cannot be correctly designed until you decide ADR-007 §3/§4.
  Proceeding without that decision would force a guess into the calculation engine, which is
  exactly what this entire four-pass investigation was structured to avoid.
- **Flat-Rate products cannot be serviced by the new system** until evidence for §4's formula is
  found — if Flat-Rate loans are needed early in Milestone 9.1's scope, this is a real scheduling
  risk, not just a documentation gap.
- **No live Postgres remains a standing risk**, unchanged from prior milestones — nothing in this
  documentation phase touched that gap.
- **The seven new documents are uncommitted** — until committed, they exist only in the working
  tree; do not treat them as durable until a commit (or explicit instruction otherwise) locks
  them in.

### 10.7 Things that should NOT be changed without a specific reason (unchanged, plus new items)
- `Money`/`Percentage`'s deterministic, no-`Result<T,E>` design (final decision, Milestone 7).
- `LoanTransaction`'s append-only guarantee (`ILoanTransactionRepository` has no `update`/
  `delete` method — do not add one).
- `LoanProductVersion`'s immutability (Milestone 7.1 fix) — do not reintroduce an in-place
  mutator.
- The `ledger`/`repayment` read-only HTTP boundary (D-2) — do not add write routes for
  `RecordLoanTransactionUseCase`/`CreateRepaymentInstallmentUseCase`/
  `RecordInstallmentPaymentUseCase` until the calculation/allocation engines exist to be their
  real, correctness-gated callers.
- The `requireAuth` → `requireRole` → `branchScope` layering and ordering (§6) — keep these
  three concerns separate; do not merge branch checks into `requireRole`.
- **New:** do not implement `CALCULATION_ENGINE_SPEC.md`'s five `UNRESOLVED` calculations from
  general lending-industry convention, even under implementation time pressure — each names the
  specific evidence that would resolve it.
- **New:** `DECLINING_BALANCE` and `DECLINING_BALANCE_DISCOUNTED` are calculation-identical per
  ADR-010 §5 — do not implement a separate upfront-interest-deduction code path for the latter;
  no evidence supports it existing in any of the 835 real loans checked.

### 10.8 Recommended path forward
1. Review the six new ADRs and `CALCULATION_ENGINE_SPEC.md`.
2. Decide ADR-007 §3 (does `outstandingBalance` include penalty?) and §4 (how to treat the 79
   non-reconciling legacy `CLOSED` loans during migration) — this is the single highest-priority
   open item blocking Milestone 9.1.
3. Optionally, resolve the smaller open sub-questions in ADR-009/ADR-010 (or explicitly accept
   carrying them forward as documented open items into implementation, as several already are).
4. Only then: analyze → design → propose a Milestone 9.1 implementation plan → **wait for
   explicit approval** → implement in small, verifiable, individually-committed checkpoints →
   verify (lint/typecheck/build/tests) after each → update this handoff at the end. This is
   unchanged from every prior milestone's discipline.
Do not start implementing anything until the user has explicitly scoped and approved Milestone 9.

---

## 11. Lessons Learned

- **Verify empirically, don't just reason.** The two most consequential audit findings (M7.1's
  `Money.allocate()` bug, M8.1's H-2 decimal-parse crash) were confirmed by actually running the
  suspect code (`node -e "..."`), not by inspection alone. Inspection alone would likely have
  missed both — the M7 code review that first introduced `Money.allocate()` had positive-only
  test cases that happened to pass.
- **Test-file mocking hygiene matters.** `vi.clearAllMocks()` vs `vi.resetAllMocks()` is a real,
  recurring pitfall — a `mockRejectedValueOnce`/`mockResolvedValue` set by one test can leak into
  a later test in the same file if only `clearAllMocks` is used in `beforeEach`. This caused a
  real, confusing test failure during Milestone 7.1's H-2 fix. Default to `resetAllMocks` in any
  file where a test overrides a mock's resolved/rejected value.
- **"Mutate then re-fetch" is a recurring pattern with a real cost.** Several Milestone 8
  controllers call a void-returning use case, then re-fetch to build the response. This works,
  but creates a race window under concurrency and wastes a round trip. Flagged as M-1, not fixed
  (out of approved scope) — worth fixing properly (use cases return the mutated aggregate) the
  next time those use cases are touched for an unrelated reason.
- **Cross-module dependencies at the application AND interface layers are an accepted, working
  pattern in this codebase** — not a Clean Architecture violation, as long as the dependency
  points at another module's **port/use-case** (never its infrastructure). Established first by
  D-3 (loan-account depends on loan-product's port), reused for H-1's repayment branch check
  (repayment's controller depends on loan-account's use case). Don't hesitate to reuse this
  pattern rather than duplicating logic.
- **Scope discipline requires explicit, itemized approval-tracking.** Every milestone in this
  project has had a clear "approved to implement" list and an equally clear "explicitly deferred"
  list, both recorded in commit messages and this handoff. When resuming work, always re-derive
  what's approved from the most recent user message and this document — never assume a
  plausible-sounding fix is in scope just because it's related to something just fixed.
- **When resuming after an interruption, verify before continuing.** Mid-Milestone-8.1, a session
  was interrupted after H-2/M-5/H-3 were code-complete but uncommitted. The correct recovery was
  to run `git status`/`git log`, confirm the working tree matched what those three findings
  required, run the full verification suite, commit that as its own checkpoint, and *then*
  continue to H-1 — not to redo any of it. This same discipline applies to any future resume.
- **Decimal/financial edge cases deserve their own explicit test category.** Both audits found
  gaps specifically in "malformed or boundary financial input" handling (negative allocation,
  non-numeric decimal strings). Any new code that accepts or computes a monetary value should get
  dedicated tests for: zero, negative, non-numeric input, and precision-boundary values, not just
  a single happy-path case.

---

## 12. Resume Instructions

**Before doing anything else, in this exact order:**

1. **Read this document in full.** Do not rely on conversation history — it may be summarized,
   truncated, or absent in a new session. This file is the source of truth for project state.
2. **Verify git status:** run `git status --short` from the repository root. Expect a clean
   working tree on `main`. If it isn't clean, inspect what's staged/unstaged before doing
   anything — it may be legitimate in-progress work from an interrupted session, not something to
   discard.
3. **Verify the latest commits:** run `git log --oneline -10` and compare against §1's commit
   list above. If there are commits not listed here, this handoff is stale — read those commits'
   messages to understand what changed, and treat their content as more authoritative than this
   document's narrative (but still update this document afterward).
4. **Do not redo completed work.** Sections 1, 3, and 4 of this document describe what's already
   done and verified. If a user request sounds like it overlaps with completed work, re-read the
   relevant commit(s) first to confirm before starting — most "gaps" are either already fixed or
   deliberately deferred (§5).
5. **Inspect the repository directly before making architectural assumptions.** This document is
   detailed but not infinite — for any specific file's current contents, read the file. Don't
   infer implementation details from this summary when the actual source is one `Read` call away.
6. **Run the verification suite before starting new work**, to confirm the baseline described in
   §1 still holds:
   ```
   cd app/backend
   npx eslint "src/**/*.ts"
   npx tsc -p tsconfig.json --noEmit
   npm run build
   npx vitest run
   ```
   Expect: lint clean, typecheck clean, build clean, **430 passed / 6 skipped / 0 failed** (71
   test files). If any of these differ, something changed since this document was written —
   investigate before proceeding, and update this handoff once you understand why. Also run
   `git status --short` — if CP6/CP7/the portability refactor/ADR-044 are no longer showing as
   uncommitted, they were committed since this document was written; re-derive commit hashes from
   `git log` and update §1/§10.0 accordingly rather than trusting the hashes recorded here.
7. **Continue from the current repository state, not from any assumption about "what comes
   next."** Milestone 9.1 CP1–CP7 are complete (CP1–CP5 committed; CP6/CP7 implemented, verified,
   and awaiting commit); CP8 (`ActivateLoanUseCase`) is next per §10.0 but has **not been started
   or approved**. Do not begin implementing CP8 or any later checkpoint beyond what the user's next
   message explicitly requests. If the user asks to "continue" without further detail, summarize
   the current state (per this document, §10.0 in particular) and ask whether to proceed with CP8
   — per `CLAUDE.md`'s "never guess, always ask when unclear" instruction.
8. **Maintain the same discipline this entire project has used:** analyze → design → propose →
   wait for approval → implement in small committed checkpoints → verify after each → update
   `PROJECT_HANDOFF.md` at the end of any milestone or remediation pass. Never skip the
   documentation step — this file is what makes the *next* handoff possible.
