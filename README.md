# EasyCash Digital Lending Platform

**Enterprise Loan Management System for Easycash Lending Company Inc.**

A ground-up rebuild of the company's lending operations — replacing Excel/Google Sheets
workflows, a legacy SDevTech platform, and a MongoDB-backed system — with a single,
configurable, auditable, and versioned Loan Management System designed for long-term
production use.

---

## Status

**Two apps, one backend, both live:**

| App | Audience | Status |
|---|---|---|
| **Easycash LMS** (`app/lmsfrontend`) | Internal staff (MIS, Loan Operation Management, CRM, Finance, Accounting, Collection) | 🟢 Live, wired to real production data — preview build |
| **Easycash Portal** (`app/portalfrontend`) | Borrowers — apply for a loan, track status, view payment history, chat with their loan officer | 🟢 Live at `easycashportal.ph` |

Both are served by the same backend (`app/easycashbackend`). Real production data has been
migrated from the legacy MongoDB/SDevTech system: thousands of borrowers, loan products, loan
accounts, and hundreds of thousands of transactions.

The platform ships frequent, dated releases. The authoritative, plain-language version history
for both apps — current version numbers, what shipped and when — lives in
[`app/lmsfrontend/src/lib/lmsVersion.ts`](app/lmsfrontend/src/lib/lmsVersion.ts) and is surfaced
on the LMS's own About page. Day-to-day engineering narrative (what was done, why, bugs found and
fixed) is recorded per session in [`docs/session-logs/`](docs/session-logs/) and
[`docs/`](docs/) (`SESSION_LOG_*.md`).

---

## Why this project exists

Easycash Lending Company Inc. previously ran on a patchwork of Excel, Google Sheets, a legacy
SDevTech lending application, and a MongoDB-backed transaction ledger. This platform replaces
that patchwork with one system, while treating the legacy data as authoritative evidence — every
non-trivial financial rule implemented here is backed by verified legacy behavior or an explicit,
confirmed business decision, not assumption.

### Core principles

- **No invented financial logic.** If a rule isn't confirmed by legacy evidence or an explicit
  business decision, it is stored as data, never guessed.
- **Configurable, versioned loan products.** Interest methods, fees, penalties, and payment
  allocation rules are configurable per product version; every approved loan keeps an immutable
  snapshot of the rules it was approved under.
- **Financial correctness over convenience.** Full audit trails, fail-closed logging on financial
  state changes, and a documented paper trail for every non-obvious decision.

---

## Technology stack

**Frontend** — React, TypeScript, Tailwind CSS, Shadcn UI, React Hook Form, Zod, TanStack Query
**Backend** — Node.js, Express.js, TypeScript, Clean Architecture (domain / application /
infrastructure / interface layers)
**Database** — PostgreSQL via Prisma ORM
**Auth** — JWT with refresh tokens, RBAC
**Deployment** — Docker, Docker Compose, self-hosted (office server / mini PC) with a Cloudflare
Tunnel for public access; portable to VPS/cloud
**Testing** — Vitest (unit + integration)

---

## Repository structure

```
app/
  easycashbackend/   Express + TypeScript API — Clean Architecture, shared by both frontends
  lmsfrontend/        React + TypeScript SPA — internal staff LMS
  portalfrontend/      React + TypeScript SPA — public borrower-facing Portal (easycashportal.ph)
  docker/             Container / compose definitions
docs/
  Architecture/       ADRs, calculation engine spec, financial invariants, milestone roadmaps
  Legacy Analysis/    Evidence-based findings from the legacy MongoDB export and Excel reports
  guides/             Setup guides (Windows, macOS, device sync, Docker cleanup, etc.)
  session-logs/       Dated session logs — what was done, in what order, why, bugs and fixes
  PROJECT_HANDOFF.md  Continuously-updated project status and history
legacy/
  mongodb/     Raw legacy MongoDB collection export (reference only, never modified)
  reports/     Legacy Excel/Google Sheets exports used as evidence for financial rules
scripts/       Operational scripts — legacy migration, database backup/update, LAN IP sync,
               Cloudflare tunnel auto-update, Docker WSL2 disk cleanup
local/         Machine-local config and credentials (gitignored) — see local/README.md
logs/          Runtime logs (gitignored)
CLAUDE.md      Engineering charter and working agreement for this codebase
```

---

## Business goals

- Replace Excel, Google Sheets, and the legacy SDevTech platform with one system
- Preserve every validated business rule from production — never silently change behavior
- Support 10,000+ borrowers, 100,000+ loans, and millions of payments
- Minimize infrastructure cost — self-hosted first, open-source where possible
- Give borrowers a self-service portal alongside the internal staff LMS
- Keep documentation and financial-rule specifications continuously in sync with the code

---

## Documentation

- [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md) — current status, architecture overview, resume instructions
- [`docs/Architecture/`](docs/Architecture/) — ADRs, `FINANCIAL_INVARIANTS.md`, `CALCULATION_ENGINE_SPEC.md`
- [`docs/Legacy Analysis/`](docs/Legacy%20Analysis/) — legacy-data investigation findings
- [`docs/guides/`](docs/guides/) — setup guides per platform/scenario
- [`docs/session-logs/`](docs/session-logs/) — dated engineering session logs
- [`CLAUDE.md`](CLAUDE.md) — engineering charter, standards, and AI-collaboration rules for this codebase

---

## License

Proprietary — internal software of Easycash Lending Company Inc. Not licensed for external use
or redistribution.
