# Easycash LMS — Project Summary

**Prepared:** 2026-07-07, refreshed 2026-07-08 (full-project re-verification + bug hunt + CP12)
**Scope:** Full-project analysis — `app/easycashbackend`, `app/lmsfrontend`, and `docs/` — verified directly
against the repository (`git log`, live test run, file listings), not reconstructed from memory.

**2026-07-08, end of day — CP12 done, Milestone 9.1 is now fully complete (CP1–CP13, nothing
gated).** Real legacy MongoDB data (Mambu-era export, `legacy/mongodb/`, gitignored) migrated into
local dev Postgres: 43 loan products, 4,604 borrowers, 1,777 loan accounts, 279,490 loan
transactions, 21,012 attachment-metadata rows — all verified directly against Postgres row counts,
not just the migration script's own log. Full design + results:
`docs/Architecture/CP12_LEGACY_MIGRATION_DESIGN.md`. Largest open finding: 46.7% of the legacy
transaction ledger (243,507 of 524,463 rows) references loan accounts no longer present in the
current `loan_accounts` snapshot — verified not a migration-script bug, explicitly accepted as a
known gap for this pass (nothing is lost — the full source ledger remains intact in the gitignored
dump). This pass targets local dev Postgres only; a production cutover against Easycash's real
backup database is an explicit longer-term goal, not yet scheduled.

**2026-07-08 re-verification:** `npx vitest run` in `app/easycashbackend` → **493 passed, 6 skipped
(integration, requires `RUN_INTEGRATION_TESTS=1`), 0 failed** (75/76 files) — unchanged from
2026-07-07. `eslint`/`tsc --noEmit` clean. `app/lmsfrontend`: `tsc -b`, `eslint`, and `npm run build`
all clean (one pre-existing informational warning: main JS chunk is 1.02 MB, above Vite's 500 kB
default threshold — not a defect, just an unaddressed code-splitting opportunity). A dedicated
codebase-wide bug hunt (two independent full-read reviews, one per track) found **3 new backend
issues and 5 new frontend issues**, none previously tracked.

**2026-07-08, later the same day — all 8 findings fixed.** See `PROJECT_HANDOFF.md` §5 for full
per-finding detail. Backend re-verified **against the live Postgres instance** (not just mocked
Prisma) with `RUN_INTEGRATION_TESTS=1`: **510/510 tests passing, 77/77 files, 0 skipped** — up from
499/499 with 6 always-skipped, because the idempotency-store rewrite (H-4) needed a real schema
migration, and it seemed worth actually proving it against Postgres rather than only mocks.
`eslint`/`tsc --noEmit` still clean. `app/lmsfrontend`: `tsc -b`, `eslint`, `npm run build` still all
clean. A brief summary of what changed, grouped by finding:
- **H-4 (idempotency race):** claim-before-execute pattern — a DB row is inserted *before* the use
  case runs, so a genuinely concurrent duplicate request collides with the unique constraint
  immediately (`409`) instead of racing the first request to completion. New migration
  `20260708062614_idempotency_claim_before_execute` (nullable `statusCode`/`responseBody`).
- **M-8 (no audit log on approve/reject):** both use cases now wrap their save + an
  `APPROVE_LOAN`/`REJECT_LOAN` audit entry in one transaction, fail-closed, matching
  `ActivateLoanUseCase`'s shape.
- **L-6 (weak refresh rate limit):** dedicated 20/15min limiter added to `/auth/refresh`.
- **F-1 through F-5 (frontend):** dashboard denominator now recomputed live; repeat-applicant
  "Create Client" now links the existing profile instead of duplicating it; the two "has active
  loan" rules now share one definition (`ACTIVE_LOAN_STATUSES`); both broken "Recent Activity"
  panels now match the `entityType` real actions actually log.

---

## 1. What This Project Is

The **Easycash Loan Management System Platform** is the enterprise digital lending platform for
**Easycash Lending Company Inc.**, intended to replace the company's legacy tooling (Excel, Google
Sheets, a prior Mambu-based system, an SDevTech platform, and a MongoDB export) while preserving
every validated business rule from that legacy data.

Two tracks were built **in parallel, deliberately not connected to each other** — **until
2026-07-08**, when the first real wiring pass connected a first slice of the two (see
`docs/Architecture/FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md`):

| Track | What it is | Status |
|---|---|---|
| **`app/easycashbackend`** | The real system — Clean Architecture, TypeScript, Express, Prisma/PostgreSQL schema, real financial calculation engine, real tests | Milestone 9.1, in progress, most-of-the-way built |
| **`app/lmsfrontend`** | A CEO-facing **UI preview**, mostly against hand-authored mock data | Feature-rich, evolving daily. **Real authentication and real Payment Recording** now call `app/easycashbackend`; every other page is still mock-only |

This split is intentional: the frontend exists to validate layout, workflow, and business rules
with the CEO *before* the corresponding backend capability is built or wired up. As of this
writing, real login (`POST /auth/login`, session refresh) and real Payment Recording (`GET
/loan-accounts`, `/repayment-schedule`, `POST /payments`) are wired; every other page — Dashboard,
Loan Applications, Client Data, Loan Accounts list/detail, Reports — still reads `mockData.ts`
only.

---

## 2. Current State

### 2.1 Backend (`app/easycashbackend`) — Milestone 9.1

**Verified fresh, 2026-07-07:** `npx vitest run` → **493 tests passed, 6 skipped, 0 failed** (75/76
test files), `eslint` and `tsc --noEmit` both clean.

**Architecture:** Clean Architecture (`domain → application → infrastructure`, `interface/http` on
top), mechanically enforced via ESLint `no-restricted-imports` (domain/application layers cannot
import infrastructure, interface, or `@prisma/client`). 8 modules: `identity`, `borrower`,
`loan-product`, `loan-account`, `ledger`, `repayment` (fully built through HTTP), `document` and
`audit` (scaffolded only, not started).

**What's implemented and working:**
- Full CRUD-ish HTTP surface for borrowers, loan products (with versioning — `LoanProductVersion`
  is immutable, editing a product never touches historical loans), and loan accounts.
- `ledger` and `repayment` are deliberately **HTTP read-only** — no route exists for
  `RecordLoanTransactionUseCase` or `CreateRepaymentInstallmentUseCase` until a real,
  correctness-gated caller exists (that caller now exists — see below).
- **The real calculation engine**: declining-balance interest, PMT amortization, and a
  fees → penalty → interest → principal payment allocator, evidence-based against the company's
  own legacy MongoDB export (524,463 transactions) and its own live Excel computation workbook.
- **`ActivateLoanUseCase`** and **`ProcessPaymentUseCase`** — the two use cases that actually move
  money — both implemented, both exposed over HTTP (`POST /loan-accounts/:id/activate`,
  `POST /loan-accounts/:id/payments`), both idempotency-key protected, both role-gated per a
  business-confirmed permission matrix (`ADR-038`).
- Optimistic concurrency (version columns + conditional updates), a fail-closed financial audit
  logger (a failed audit write rolls back the whole transaction, never silently continues),
  branch-scoped authorization layered separately from role authorization.
- Two full post-implementation audits (Milestone 7.1, Milestone 8.1) with every Critical/High
  finding fixed and verified with a regression test.

**What's explicitly not built yet, on purpose:**
- **CP12** (legacy migration treatment) — the only remaining Milestone 9.1 checkpoint. Its blocking
  business decision (`ADR-007 §4`: how to treat 79 non-reconciling legacy `CLOSED` loans during
  migration) was **RESOLVED 2026-07-08** (Option A — migrate all 1,799 legacy loans as-is,
  including the 79, flagged for manual accounting review post-migration; confirmed by Nomer Perez,
  MIS Manager). CP12 itself is not yet built — only its gating decision is now clear.
- **Correction (2026-07-08): the claim previously here — "no financial-write use case yet logs an
  `AuditLog` entry" — was factually wrong.** `IFinancialAuditLogger`/`PrismaFinancialAuditLogger`
  (ADR-047, fail-closed by design) were built 2026-07-04 (CP2), and both `ActivateLoanUseCase` and
  `ProcessPaymentUseCase` already call `.log()` inside their `IUnitOfWork.run()` block, with a
  passing fail-closed regression test for each (`tests/unit/loan-account/ActivateLoanUseCase.test.ts`,
  `ProcessPaymentUseCase.test.ts` — both assert the whole transaction rejects if the audit write
  fails). Verified directly against the source and by running the suite, not re-derived from this
  document. **No `document` module capability exists yet** (0 files) — that part of the original
  claim stands; only the `audit` half was wrong.
- ~~**No live PostgreSQL has ever been available in this dev environment**~~ — **CLOSED
  2026-07-08.** Docker Desktop installed (required a WSL2 base distro, which this machine also
  lacked — installed via `wsl --install`), `docker compose up -d postgres` brought up a real
  PostgreSQL 16 instance, and all 5 migrations were deployed successfully (29 tables). The
  previously-skipped `tests/integration/` suite (`auth.test.ts`,
  `GoldenMasterReplay.test.ts` — real HTTP round-trips via `supertest` against a real database, not
  mocked) was run for the first time with `RUN_INTEGRATION_TESTS=1`: **all 10 integration tests
  pass**, including the full login → refresh-rotation → reuse-detection (C-01) → rate-limit flow.
  Combined with the unit suite: **76/76 test files, 499/499 tests passing** (previously 6 were
  always skipped pending exactly this). This was the single largest outstanding verification gap in
  the whole backend — it is now closed, clearing the last precondition for scoping CP12 (§4.3).
- Five calculation cases are explicitly flagged `STATUS: UNRESOLVED` in
  `CALCULATION_ENGINE_SPEC.md` (Flat-Rate interest, overpayment handling, penalty formula,
  maturity-capitalization timing, reversal/adjustment modeling) — deliberately not implemented
  from generic lending convention, because no legacy evidence supports guessing at them.

### 2.2 Frontend (`app/lmsfrontend`) — UI Preview

**Verified fresh, 2026-07-07:** `tsc --noEmit`, `eslint`, and `npm run build` all clean.

20 pages, spanning every module the finished platform needs to demonstrate:

- **Loan lifecycle:** Loan Applications (with a static/mock AI risk assessment, repeat-client
  detection, application → client → loan-account workflow), Loan Accounts list/detail, Client
  Data, Loan Products (3 real active categories — Salary, Business, Seafarer — with all ~40
  discontinued legacy product codes preserved and visible).
- **Money movement:** Payment Recording (automatic fees→penalty→interest→principal allocation per
  `ADR-009`, plus a manual-override mode), Payment Reminders (automated 5/3/1-day/due/weekly
  schedule across SMS/email/dashboard).
- **Reporting:** Loan Report, Collection Report, Transaction Report, Statement of Account — every
  table has sortable columns, date columns defaulting newest-first.
- **Management Dashboard:** a real analytics layer over the mock data —
  - **Loan Portfolio Health** — a Venn diagram (Good / In Arrears / Matured), with per-segment
    Interest Income / Accrued Revenue / Credit Loss figures.
  - **Portfolio Quality Metrics** — Delinquency Rate, Portfolio at Risk (PAR), Average Loan Size,
    Write-off exposure, using standard lending-industry definitions with in-app hover definitions.
  - **Every chart, bar, pie slice, and metric is clickable** and drills down to the exact loan
    accounts behind that figure.
  - **Portfolio Filters** — category + date-range filters that recompute the Portfolio Breakdown
    and Loan Portfolio Health totals live.
  - A **Recommendation** panel (renamed from "AI Portfolio Assist") with static, per-segment
    guidance, clearly disclosed as a mock, not a live AI engine.
- **Administration:** LMS Configuration (MIS-only theme-color picker — Easycash Emerald default —
  and light/dark mode), Member Details, Generated Documents registry, Loan Products, Activity
  Logs (MIS-only), and a new **About** page (app identity, version number, in-app changelog,
  developer-team credit, and a disclosure of the planned future client-facing "Easycash Portal").
- **Access model:** a mock "Switch Account" panel demonstrating the six confirmed staff roles
  (MIS, Loan Operation Manager, CRM, Finance, Accounting, Collection Officer) and how the UI's
  own access changes live per role — not real authentication, but a faithful preview of the
  authorization model already implemented on the backend.

**What it deliberately is not:** connected to anything. Every figure is computed client-side from
`src/lib/mockData.ts`; a "Preview Mode" banner is always visible; the mock-data file's own
top-of-file comment repeats the same disclosure.

### 2.3 Documentation

17 Architecture documents (ADRs + specs) plus a ~1,340-line Legacy Analysis document, all
evidence-cited against the real legacy MongoDB export and Excel reports. `PROJECT_HANDOFF.md`
(1,058 lines) is the authoritative, continuously-updated resume point for any new session working
on the backend track.

---

## 3. Plans and Phase

Per the project's own milestone numbering:

| Milestone | Status |
|---|---|
| 1–6 (architecture, schema, migrations, auth) | ✅ Complete |
| 7 (core domain), 7.1 (audit remediation) | ✅ Complete |
| 8 (HTTP layer), 8.1 (audit remediation) | ✅ Complete |
| 9 (legacy evidence, ADRs, calc engine spec) | ✅ Complete |
| **9.1 (calculation engine implementation)** | **✅ Complete — CP1–CP13 all done, CP12 run 2026-07-08 (real legacy data migrated to local dev Postgres)** |
| 9.2 | CP13 (HTTP exposure for activate/payment) shipped under this number |
| **Frontend UI-preview track** | **Ongoing, evolving daily, parallel to Milestone 9.1 — not on the numbered milestone track. Real login and Payment Recording wired to the backend as of 2026-07-08 (see `docs/Architecture/FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md`); every other page still mock-only.** |

**The project is currently at an inflection point.** The backend's calculation engine — the hardest
and most business-risk-laden part of the whole platform — is done, tested, and now has real legacy
data behind it (CP12, 2026-07-08). Meanwhile, the frontend has grown into a fully-featured,
good-looking preview that the CEO can react to, and a first wiring pass (real login, real Payment
Recording) already closed part of the gap. It still has **no live wire to the backend that
already exists to serve it**.

### Trajectory

If both tracks continue exactly as they have been:
- The backend can now finish Milestone 9.1 with CP12 alone, needing at most a small,
  well-scoped CP12 checkpoint.
- The frontend will keep growing in polish and feature surface indefinitely, because there is no
  natural "done" signal for a preview with no backend behind it — every new idea is easy to add as
  another mock card.
- **The gap between the two tracks will keep widening.** The frontend's data model (`MockLoanAccount`,
  the `MATURED` status, the Venn/Recommendation model, the filters) is not derived from the
  backend's actual API contracts — it is invented independently, page by page. The longer this
  continues, the more expensive the eventual wiring pass becomes, because two independently-evolved
  mental models of "what a loan account is" have to be reconciled.

---

## 4. Recommendations and Suggestions

### 4.1 ~~Decide ADR-007 §4 now — it is the single highest-leverage open item~~ — DONE 2026-07-08

**Resolved.** Option A selected (migrate all 1,799 legacy loans as-is, flag the 79 non-reconciling
`CLOSED` accounts for manual review), confirmed by Nomer Perez (MIS Manager), 2026-07-08 — see
`ADR-007` §4 for the full decision record, plus new supporting evidence gathered the same day
(year-of-origination and product-type breakdown of the full 79-loan population, and a full
transaction-history trace of one representative account) that rules out pandemic-era non-payment
as the dominant cause and confirms at least some of the 79 hold real, not-yet-resolved balances
rather than safe-to-discard artifacts. **Next highest-leverage item is now 4.3 below** (standing up
Postgres) as the precondition for actually scoping/building CP12.

### 4.2 Scope and start the frontend↔backend wiring pass deliberately, before the frontend grows further

This is the most important structural recommendation. Concretely:
- Pick **one** screen as the pilot — Payment Recording is the natural choice, since
  `ProcessPaymentUseCase` and its HTTP route already exist and are tested.
- Wire that one screen to the real API, end to end, including error states, loading states, and
  the idempotency-key header the backend already expects.
- Only after that pilot succeeds, wire the rest — using it as the template for auth (JWT), roles
  (the mock "Switch Account" panel should become a real login), and data shape (the mock
  `MockLoanAccount` interface should be reconciled field-by-field against the real
  `LoanAccountPresenter` output).
- **Freeze new mock-only dashboard features until the pilot ships.** Every dashboard addition since
  the CP13 backend milestone (Venn diagram, filters, quality metrics, Recommendation panel) has been
  frontend-only. This is valuable for stakeholder buy-in but has an opportunity cost: each new mock
  concept (e.g., the `MATURED` status, `Credit Loss`/`Accrued Revenue` figures) is a data-model
  decision that the backend has not made and will eventually need to either adopt or reconcile
  against.

### 4.3 ~~Address the standing "no live PostgreSQL" gap before CP12~~ — DONE 2026-07-08

**Resolved.** Docker Desktop + WSL2 installed, `docker compose up -d postgres` running, all 5
migrations deployed, and the full test suite (unit + previously-skipped integration) passes clean
against it — 499/499 tests, 76/76 files. CP12 can now be scoped and built with a real database
available to migrate into and verify against, per the original concern here.

### 4.4 ~~Build the `audit` module before, not after, any real production use~~ — ALREADY DONE, this recommendation was based on a factual error

**This recommendation is moot — verified 2026-07-08 by reading the source directly.**
`FINANCIAL_INVARIANTS.md §4`'s fail-closed audit-write rule (`ADR-047`) is not just designed but
**already implemented and wired in**: both `ActivateLoanUseCase` and `ProcessPaymentUseCase` call
`financialAuditLogger.log()` inside their `IUnitOfWork.run()` block (no try/catch — a rejection
aborts the whole transaction), and each has a passing fail-closed regression test asserting exactly
that. This was built 2026-07-04 (CP2), predating this document's own "Verified fresh, 2026-07-07"
pass — the original claim here should have been caught then and wasn't. Nothing to build; no
action needed. The `document` module (server-side document generation/storage) remains genuinely
unbuilt (0 files) if that capability is ever needed.

### 4.5 Resolve the frontend's small internal inconsistencies before they compound

- The Administration sidebar currently reads **"Generated Documents"**; an earlier request named
  this section **"Document Templates"** — this naming question was paused mid-conversation and
  never resolved. Worth closing out, since it's a one-line fix now and a larger one later if more
  pages start linking to it under either name.
- The mock data's `MATURED` status (a real, useful addition — an active loan past its full term but
  still unpaid) exists **only in the frontend**. If/when this concept is judged real and useful
  (it is consistent with standard lending practice), it should be proposed as a real ADR/schema
  addition on the backend, rather than staying a frontend-only invention that the eventual wiring
  pass has to somehow reconcile.

### 4.6 Keep the documentation discipline that has made this project easy to resume

`PROJECT_HANDOFF.md` and this project's ADR trail are genuinely unusual in how well they let a new
session (or a new engineer) pick up exactly where the last one left off, with a clear record of what
was decided, why, and what's still open. This discipline has a real cost (a lot of prose gets
written) but has clearly paid for itself already — continue it, especially through the CP12 /
migration phase, which is the highest-risk remaining backend work.

### 4.7 The 2026-07-08 bug-hunt backlog — all 8 findings fixed the same day

A dedicated full-read review (not just `tsc`/`eslint`, which both stayed clean throughout) found 8
concrete, verified bugs across both tracks. Initially logged documentation-only (per `CLAUDE.md`'s
"analyze → design → wait for approval" workflow, since several touched business logic — duplicate
client creation, double-payment risk — that deserved an explicit go-ahead before changing anything).
User approved fixing all 8 the same day; all landed and re-verified — backend against the **live
Postgres instance** (510/510 tests, up from 499/499 mocked-only, since the idempotency fix needed a
real migration and it was worth proving against a real database), frontend build/lint/tsc still
clean. Full per-finding detail (what changed, file/line) is in `PROJECT_HANDOFF.md` §5.

---

## 5. One-paragraph Executive Summary

The Easycash LMS backend has a working, well-tested, evidence-based financial core (loan
origination, activation, and payment processing, all reachable over a real, role-gated HTTP API),
and as of 2026-07-08, **Milestone 9.1 is fully complete** — CP12 (legacy migration) ran the same
day, putting real historical loan/borrower/transaction data behind that engine for the first time.
The hardest engineering risk in the project is retired. In parallel, a fast-moving, increasingly
rich frontend UI preview has demonstrated the platform's look, feel, and workflow to the business,
and a first wiring pilot (also 2026-07-08) already closed part of the gap between the two tracks —
real login and real Payment Recording now call the backend directly; every other page remains
mock-only. The single highest-leverage next step for the project as a whole is extending that same
wiring pattern to the rest of the frontend, one screen at a time, now backed by real data instead
of an empty database.
