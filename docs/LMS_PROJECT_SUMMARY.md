# Easycash LMS — Project Summary

**Prepared:** 2026-07-07
**Scope:** Full-project analysis — `app/backend`, `app/frontend`, and `docs/` — verified directly
against the repository (`git log`, live test run, file listings), not reconstructed from memory.

---

## 1. What This Project Is

The **Easycash Loan Management System Platform** is the enterprise digital lending platform for
**Easycash Lending Company Inc.**, intended to replace the company's legacy tooling (Excel, Google
Sheets, a prior Mambu-based system, an SDevTech platform, and a MongoDB export) while preserving
every validated business rule from that legacy data.

Two tracks are being built **in parallel, deliberately not yet connected to each other**:

| Track | What it is | Status |
|---|---|---|
| **`app/backend`** | The real system — Clean Architecture, TypeScript, Express, Prisma/PostgreSQL schema, real financial calculation engine, real tests | Milestone 9.1, in progress, most-of-the-way built |
| **`app/frontend`** | A CEO-facing **UI preview** against hand-authored mock data | Feature-rich, evolving daily, **zero API calls into the backend** |

This split is intentional: the frontend exists to validate layout, workflow, and business rules
with the CEO *before* the corresponding backend capability is built or wired up. As of this
writing, the backend has real HTTP endpoints for loan activation and payment recording (CP13) that
the frontend does not yet call.

---

## 2. Current State

### 2.1 Backend (`app/backend`) — Milestone 9.1

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
- `document` and `audit` modules — no financial-write use case yet logs an `AuditLog` entry, and
  no document-generation/storage capability exists server-side.
- **No live PostgreSQL has ever been available in this dev environment** — every DB-dependent
  claim is verified via `tsc`, mocked-Prisma unit tests, and mocked `supertest` requests. This
  remains the single largest outstanding verification gap in the whole backend.
- Five calculation cases are explicitly flagged `STATUS: UNRESOLVED` in
  `CALCULATION_ENGINE_SPEC.md` (Flat-Rate interest, overpayment handling, penalty formula,
  maturity-capitalization timing, reversal/adjustment modeling) — deliberately not implemented
  from generic lending convention, because no legacy evidence supports guessing at them.

### 2.2 Frontend (`app/frontend`) — UI Preview

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
| **9.1 (calculation engine implementation)** | **In progress — CP1–CP11 and CP13 done; ADR-007 §4 resolved 2026-07-08, CP12 unblocked and ready to be scoped/built** |
| 9.2 | CP13 (HTTP exposure for activate/payment) shipped under this number |
| **Frontend UI-preview track** | **Ongoing, evolving daily, parallel to Milestone 9.1 — not on the numbered milestone track** |

**The project is currently at an inflection point.** The backend's calculation engine — the hardest
and most business-risk-laden part of the whole platform — is essentially done and tested. The
former blocking item (CP12) had its business decision resolved 2026-07-08 (see ADR-007 §4) — the
only remaining work is engineering (scoping and building CP12 itself, ideally alongside standing up
a real PostgreSQL instance per §4.3 below). Meanwhile, the frontend has grown into a fully-featured,
good-looking preview that the CEO can react to, but it has **no live wire to the backend that
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

### 4.3 Address the standing "no live PostgreSQL" gap before CP12

Every backend claim to date has been verified without ever running against a real database. This
has been an acceptable trade-off through the domain/application layers (which are correctly
DB-agnostic by design), but CP12 is specifically about **migration** — moving real legacy data into
this schema. That work cannot be meaningfully verified without at least one real Postgres instance
to migrate into. Standing up Postgres (even just locally via the project's existing
`docker-compose`) should happen before or alongside CP12, not after.

### 4.4 Build the `audit` module before, not after, any real production use

`FINANCIAL_INVARIANTS.md §4`'s fail-closed audit-write rule is fully designed and even has a tested
implementation pattern (`PrismaFinancialAuditLogger`), but **no financial-write use case actually
calls it yet** — `ActivateLoanUseCase` and `ProcessPaymentUseCase` do not write `AuditLog` entries
despite being the two use cases that move real money. This is a real, load-bearing gap for a
financial system and should be closed before any live-money usage, not treated as a nice-to-have.

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

---

## 5. One-paragraph Executive Summary

The Easycash LMS backend has a working, well-tested, evidence-based financial core (loan
origination, activation, and payment processing, all reachable over a real, role-gated HTTP API) —
the hardest engineering risk in the project is largely retired. The one remaining Milestone 9.1
checkpoint (CP12) was blocked on a business decision, not a technical one — that decision was made
2026-07-08 (ADR-007 §4, Option A: migrate all legacy loans as-is, flag the 79 non-reconciling ones
for manual review), so only the engineering work of building CP12 itself remains. In parallel, a
fast-moving, increasingly rich frontend UI preview has demonstrated the platform's look, feel, and
workflow to the business, but remains entirely disconnected from the real backend that already
exists to serve it. The single highest-leverage next step for the project as a whole is not more
backend checkpoints or more frontend polish, but a deliberate, scoped pilot that wires one real
screen end-to-end — closing the gap between the two tracks before it grows any wider.
