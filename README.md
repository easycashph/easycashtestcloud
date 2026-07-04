# EasyCash Digital Lending Platform

**Enterprise Loan Management System for Easycash Lending Company Inc.**

A ground-up rebuild of the company's lending operations — replacing Excel/Google Sheets
workflows, a legacy SDevTech platform, and a MongoDB-backed system — with a single,
configurable, auditable, and versioned Loan Management System designed for long-term
production use.

---

## Status

**Phase:** Milestone 9.1 — Loan Activation & Payment Processing implementation
**Latest completed checkpoint:** CP7 (`LoanAccount.activate()` / `applyPayment()` domain methods)
**Next up:** CP8 (`ActivateLoanUseCase`)

| Area | Status |
|---|---|
| Domain layer (Clean Architecture core) | ✅ Complete (Milestone 7, audited & remediated) |
| HTTP API layer | ✅ Complete (Milestone 8, audited & remediated) |
| Legacy-data architecture research (ADRs, calculation engine spec) | ✅ Complete |
| Concurrency infrastructure, financial audit logging, interest/amortization calculators, payment allocation | ✅ Done (CP1–CP5) |
| Repository conditional-write refactor, loan activation/payment domain methods | ✅ Done (CP6–CP7) |
| Loan activation use case (ledger entry, schedule generation, audit log) | 🔶 In progress (CP8) |
| Online loan application portal, customer self-service, reporting/analytics | ⏳ Planned |

Test suite: 430+ unit tests passing. Full architectural decision history and current progress
are tracked in [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md) — read this before making
any implementation decision.

---

## Why this project exists

Easycash Lending Company Inc. previously ran on a patchwork of Excel, Google Sheets, a legacy
SDevTech lending application, and a MongoDB-backed transaction ledger. This platform replaces
that patchwork with one system, while treating the legacy data as authoritative evidence — every
non-trivial financial rule implemented here is backed by a documented Architecture Decision
Record (ADR) tracing back to verified legacy behavior, not assumption.

### Core principles

- **No invented financial logic.** If a rule isn't confirmed by legacy evidence or an explicit
  business decision, it is stored as data, never guessed.
- **Configurable, versioned loan products.** Interest methods, fees, penalties, and payment
  allocation rules are configurable per product version; every approved loan keeps an immutable
  snapshot of the rules it was approved under.
- **Financial correctness over convenience.** Optimistic concurrency on every balance-mutating
  write, fail-closed audit logging on every financial state change, and a full paper trail (ADRs)
  for every non-obvious decision.

---

## Technology stack

**Frontend** — React, TypeScript, Tailwind CSS, Shadcn UI, React Hook Form, Zod, TanStack Query
**Backend** — Node.js, Express.js, TypeScript, Clean Architecture (domain / application /
infrastructure / interface layers)
**Database** — PostgreSQL via Prisma ORM
**Auth** — JWT with refresh tokens, RBAC
**Deployment** — Docker, Docker Compose (self-hosted first; portable to VPS/cloud)
**Testing** — Vitest (unit + integration)

---

## Repository structure

```
app/
  backend/     Express + TypeScript API — Clean Architecture (domain/application/infrastructure/interface)
  frontend/    React + TypeScript SPA
  docker/      Container definitions
docs/
  Architecture/       ADRs, calculation engine spec, financial invariants, milestone roadmaps
  Legacy Analysis/    Evidence-based findings from the legacy MongoDB export and Excel reports
  PROJECT_HANDOFF.md  Authoritative, continuously-updated project status and history
legacy/
  mongodb/     Raw legacy MongoDB collection export (reference only, never modified)
  reports/     Legacy Excel/Google Sheets exports used as evidence for financial rules
CLAUDE.md      Engineering charter and working agreement for this codebase
```

---

## Business goals

- Replace Excel, Google Sheets, and the legacy SDevTech platform with one system
- Preserve every validated business rule from production — never silently change behavior
- Support 10,000+ borrowers, 100,000+ loans, and millions of payments
- Minimize infrastructure cost — self-hosted first, open-source where possible
- Support a future online loan application portal, customer self-service portal, and
  management/reporting dashboards
- Keep documentation and financial-rule specifications continuously in sync with the code

## Roadmap

1. ~~Domain layer (Clean Architecture core)~~ — done
2. ~~HTTP API layer~~ — done
3. ~~Legacy-evidence architecture research~~ — done
4. **Loan activation & payment processing (current)** — schedule generation, ledger entries,
   fail-closed audit logging
5. Reporting & analytics, notification services, document management
6. Online loan application portal, customer self-service portal
7. Migration of validated legacy data into production

See [`docs/Architecture/MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`](docs/Architecture/MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md)
for the current milestone's detailed checkpoint plan.

---

## Documentation

- [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md) — current status, architecture overview, test coverage, resume instructions
- [`docs/Architecture/`](docs/Architecture/) — ADRs, `FINANCIAL_INVARIANTS.md`, `CALCULATION_ENGINE_SPEC.md`
- [`docs/Legacy Analysis/`](docs/Legacy%20Analysis/) — legacy-data investigation findings
- [`CLAUDE.md`](CLAUDE.md) — engineering charter, standards, and AI-collaboration rules for this codebase

---

## License

Proprietary — internal software of Easycash Lending Company Inc. Not licensed for external use
or redistribution.
