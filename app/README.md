# EasyCash Digital Lending Platform — `app/`

New, from-scratch implementation of the Loan Management System. Built strictly from the frozen
Phase 0/Phase 1 specification (`docs/` at the repository root) — no legacy code is copied.
`legacy/` is reference-only and is never modified.

## Stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Auth:** JWT (access + refresh), bcrypt
- **Deployment:** Docker Compose, self-hosted first

## Local development

Prerequisites: Node.js 20+, Docker (for PostgreSQL).

```bash
# 1. Install dependencies (from app/)
npm install

# 2. Start PostgreSQL (and, once built out, the full stack)
docker compose -f docker/docker-compose.yml up -d postgres

# 3. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# edit backend/.env — set real JWT secrets before anything beyond local dev

# 4. Apply the database schema
npm run prisma:migrate
npm run prisma:seed

# 5. Create the first Administrator account (one-time; refuses to run twice —
#    see backend/scripts/bootstrap-admin.ts). Prompts interactively, or set
#    BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD / _FIRST_NAME / _LAST_NAME.
npm run bootstrap:admin --workspace backend

# 6. Run backend and frontend (separate terminals)
npm run dev:backend
npm run dev:frontend
```

## First login

`POST /api/v1/auth/login` with the email/password from step 5 returns a short-lived access
token (JSON body) and sets an `HttpOnly` refresh-token cookie. See Milestone 6's plan
(`docs/`) for the full endpoint list, token lifecycle, and security rationale. Authorization
(permission-level enforcement beyond "is this token valid") is a later milestone — Milestone 6
covers authentication only.

## Architecture

Clean Architecture, modular monolith. Each backend module under `backend/src/modules/<name>/` has:

- `domain/` — entities, value objects, invariants (framework-free)
- `application/` — use cases, DTOs, port interfaces
- `infrastructure/` — Prisma repositories, adapters (implements the ports)
- `interface/http/` — Express controllers/routes, request validation

See the repository root `docs/` for the full specification this implementation traces back to:
Phase 0 Discovery, Phase 1 Core Domain Model, Domain Glossary, Phase 1.5 Domain Invariants, and
the Architecture Decision Register (ADR). Code comments reference specific rule/ADR IDs
(e.g. `LA-3`, `ADR-005`) wherever a design choice implements or works around one of them.

## Status

Milestones 1–5 (architecture, folder structure, project init, database schema, migrations) and
a schema-review follow-up migration are complete. Milestone 6 (Authentication — login, refresh-
token rotation with reuse detection, logout, get-current-user, first-admin bootstrap) is
complete; authorization/RBAC enforcement is explicitly deferred to a later milestone. See the
ADR register for open decisions that provisional choices in this codebase are tracking.
