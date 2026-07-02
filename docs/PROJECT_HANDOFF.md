# EasyCash Digital Lending Platform — Project Handoff

**Purpose of this document:** a complete, self-contained briefing for a brand-new Claude Code
conversation that has never seen this project before. It summarizes everything built and
decided through the end of Milestone 6 (Authentication), cross-checked directly against the
repository rather than reconstructed from memory. If you are picking up this project fresh,
read this document before touching any code.

**Important caveat about this document's own provenance:** the project's Phase 0 (Discovery)
and Phase 1 (Core Domain Model, Domain Glossary, Domain Invariants, Architecture Decision
Register) work was produced in prior chat sessions but was **never persisted as files** —
`docs/Architecture/`, `docs/Legacy Analysis/`, `docs/Reports/`, and `docs/SRS/` all exist as
empty directories in this repository. This handoff document is the **first durable artifact**
capturing that work, reconstructed from the author's own record of those sessions. Section 6
(ADR Status) is the most affected by this — treat it as the best available summary, not a
verbatim reproduction of a document that was never actually written to disk. If a future
session has time, formally re-creating `docs/Architecture/ADR_REGISTER.md` and
`docs/Architecture/DOMAIN_GLOSSARY.md` as standalone files would close this gap permanently.

---

## 1. Project Overview

### Purpose
EasyCash Lending Company Inc. is a real, operating Philippine lending company (SEC Reg.
CS201001882, COA No. 640). This project replaces its legacy systems — Excel/Google Sheets
workflows, a Mambu-derived MongoDB core ledger, and a custom "SDevTech" dashboard — with a new,
from-scratch, production-ready Loan Management System. The new system must preserve validated
legacy business rules (interest methods, fee/penalty structures, audit requirements) while
being maintainable, secure, and scalable to 10,000+ borrowers / 100,000+ loans / millions of
payments (per `CLAUDE.md`'s stated performance goals).

### Technology Stack
- **Backend:** Node.js 20, Express 4, TypeScript (strict mode), Prisma ORM, PostgreSQL 16
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod,
  React Router (Shadcn UI components not yet added)
- **Auth:** JWT (HS256 access tokens) + opaque HMAC-hashed refresh tokens, bcrypt
- **Testing:** Vitest (unit + integration), Supertest
- **Deployment:** Docker Compose (self-hosted first, per `CLAUDE.md`'s cost-minimization
  philosophy), PostgreSQL + backend + frontend services defined in `app/docker/docker-compose.yml`

### Architectural Style
**Clean Architecture**, implemented as a **modular monolith** with **DDD-lite bounded
contexts**. Each backend module lives under `app/backend/src/modules/<name>/` with four layers:

```
interface/http   →   application   →   domain
                          ↑
                   infrastructure (implements application's port interfaces)
```

- `domain/` — entities, value objects (framework-free, no Prisma/Express imports)
- `application/` — use cases, DTOs, port interfaces, typed errors
- `infrastructure/` — Prisma repositories and adapters implementing the ports
- `interface/http/` — Express controllers/routes, Zod request validation

An ESLint rule (scoped via `overrides` in `app/backend/.eslintrc.json` to
`src/modules/*/domain/**` and `src/modules/*/application/**`) mechanically enforces that these
two inner layers cannot import anything from `infrastructure/` or `interface/` paths. The
composition root (`app/backend/src/app.ts`) is the one place infrastructure gets wired into
application-layer use cases.

Eight bounded-context modules are scaffolded (folder structure only, per Milestone 1-2):
`identity`, `borrower`, `loan-product`, `loan-account`, `ledger`, `repayment`, `document`,
`audit`. **Only `identity` has been built out** (Milestone 6). The other seven contain only
`.gitkeep` placeholders marking the intended layer structure.

### Repository Structure (top level)
```
CLAUDE.md              — primary AI/engineering instructions (read this first)
PROJECT_RULES.md        — business rules & functional requirements (living document)
README.txt              — original project overview
legacy/                 — REFERENCE ONLY, never modified. MongoDB export, Excel reports,
                           website HTML exports from the legacy systems.
docs/                   — intended for architecture/SRS/reports docs; currently EMPTY except
                           this new file (see caveat above)
app/                    — ALL new application code lives here (per explicit instruction:
                           "Build ONLY inside the app folder")
  backend/              — Express/TypeScript/Prisma API
  frontend/             — React/Vite SPA (currently a placeholder shell)
  docker/               — docker-compose.yml + Dockerfiles
```

---

## 2. Completed Milestones

### Milestone 1-2 — Architecture & Folder Structure
**Objective:** establish the Clean Architecture skeleton before any feature code.
**Work completed:** created the `app/` directory tree — npm-workspaces monorepo root, 8 backend
module folders each with the 4-layer structure, `shared/` cross-cutting folder, `docker/`
folder.
**Major files/modules introduced:** `app/package.json` (workspaces root), the empty module
scaffolds under `app/backend/src/modules/*`.
**Architectural decisions:** Clean Architecture over a simpler MVC structure, chosen for
long-term maintainability given the project's explicit multi-year horizon (per `CLAUDE.md`);
modular monolith over microservices, chosen for low operational cost on a self-hosted target.
**Verification:** directory structure created and reviewed; no code to build/test yet.

### Milestone 3 — Project Initialization
**Objective:** get a real, runnable Express server with production-grade baseline concerns.
**Work completed:** backend/frontend `package.json`/`tsconfig.json` with strict TypeScript,
ESLint + Prettier configs, Zod-validated fail-fast environment config
(`shared/config/env.ts`), secure-by-default Express app (`helmet`, `cors`, global rate limit,
`pino` structured logging), a `/health` endpoint, Docker Compose service definitions.
**Major files/modules introduced:** `app/backend/src/app.ts`, `server.ts`,
`shared/config/env.ts`, `shared/logger/logger.ts`, `shared/middleware/errorHandler.ts`,
`shared/errors/DomainError.ts`, `app/docker/*`.
**Architectural decisions:** `Result<T,E>` type (`shared/result.ts`) established as the
intended pattern for expected business-rule failures (not yet used anywhere — see §8 debt);
`DomainError` base class with a `httpStatus` field (later extended in Milestone 6) as the
single error-to-HTTP-response mapping mechanism.
**Verification:** backend built, ran, and was smoke-tested locally (`/health` returned 200
with correct security headers); frontend built with Vite.

### Milestone 4 — Database Schema
**Objective:** translate the (separately-produced, never-persisted) Phase 1 Core Domain Model
and Domain Invariants into a complete Prisma schema.
**Work completed:** full `schema.prisma` — **27 models, 17 enums** (see §3 for the full list).
Every model and non-obvious field carries a `///` doc comment tracing it to a specific Phase
1.5 invariant rule ID (e.g. `LA-3`, `TXN-1`) or ADR (e.g. `ADR-005`), so the schema is
self-documenting even though the source specification documents themselves were never written
to `docs/`.
**Major files/modules introduced:** `app/backend/prisma/schema.prisma`.
**Architectural decisions (see §5 for full detail):** UUID primary keys throughout;
`Decimal(14,2)` for money, `Decimal(6,3)` for rates/percentages; nullable, unique `legacyId`
columns on entities that map to a legacy MongoDB collection (traceability for a future
migration phase, without building a full crosswalk table prematurely); no `outstandingBalance`
column (computed in the domain layer once the formula ADR resolves — see ADR-007); several
"mechanism exists but not enforced" columns (e.g. `PenaltyRule.capPercent`) deliberately left
unused pending open ADRs, documented inline rather than silently omitted.
**Verification:** `prisma format`, `prisma validate`, `prisma generate` all passed (no live
Postgres was available in this dev environment at any point in the project so far — this
recurs as a theme throughout; see §11).

### Milestone 5 — Migrations & Seed
**Objective:** produce the initial database migration and baseline seed data.
**Work completed:** initial migration (`prisma/migrations/20260702000000_init/migration.sql`,
generated via `prisma migrate diff --from-empty` since `prisma migrate dev` requires a live DB
connection this environment doesn't have — the output was cross-checked byte-for-byte against
what Prisma's own diff engine produces). `prisma/seed.ts` seeds exactly: one provisional
"Head Office" `Branch` (code `HQ`, per ADR-005), the 6 baseline `Role`s (Administrator,
Manager, Loan Officer, Cashier, Collection Officer, Viewer, per AUDIT-4), and a starter
`Permission` set with Administrator granted all of them. **Deliberately does not seed a
default admin user with a known password** — that's `scripts/bootstrap-admin.ts`, added in
Milestone 6.
**Major files/modules introduced:** `prisma/migrations/20260702000000_init/`, `prisma/seed.ts`.
**Verification:** migration SQL manually verified against `prisma migrate diff` output; full
schema/build verification passed.

### Schema Review Follow-Up (between Milestone 5 and 6)
A dedicated schema audit (separate from the Milestone 6 code audit) found: 16 missing
production indexes (Borrower search fields, LoanAccount/LoanTransaction branch/officer/date
filters, RepaymentSchedule due-date/status, AuditLog timestamp/user) and one Hard Rule
(`LPV-2`: only one Active `LoanProductVersion` per product) that was documented as an
application-layer responsibility but had no database-level enforcement. **Fixed:** all 16
indexes added via `@@index`; `LPV-2` enforced via a hand-written PostgreSQL **partial unique
index** (`CREATE UNIQUE INDEX ... WHERE "isActive" = true`) in a second migration
(`20260702010000_schema_review_indexes_and_lpv2_guard`), since Prisma's schema DSL cannot
express conditional/partial unique constraints — this is documented both in the migration file
and inline in `schema.prisma`. Also added explicit schema comments for two previously-implicit
decisions: **ADR-004** (Group-held loans intentionally out of scope) and **ADR-032** (working
assumption that "Loan Release" and "Disbursement" are two distinct events).

### Milestone 6 — Authentication
**Objective:** email+password login, JWT session management, logout, and a first-admin
bootstrap — identity verification only, **not** authorization/permission enforcement (explicit
scope boundary).

**Work completed (initial build):**
- 5 endpoints under `/api/v1/auth`: `POST /login`, `POST /refresh`, `POST /logout`,
  `POST /logout-all`, `GET /me`
- Full 4-layer `identity` module: domain (`Email`, `PasswordPolicy`), application (5 use cases,
  5 port interfaces, typed errors), infrastructure (4 Prisma-backed adapters), interface
  (controller, router, Zod schemas, cookie helpers)
- `shared/middleware/requireAuth.ts` (JWT verification, reusable by all future modules),
  `shared/middleware/validate.ts` (generic Zod body validator), `shared/database/prismaClient.ts`
  (singleton Prisma client)
- `scripts/bootstrap-admin.ts` — guarded, one-time CLI to create the first Administrator

**Work completed (post-implementation audit — 6 blocking findings, all fixed):**
1. **C-01** — refresh-token rotation made atomic (`revoke()` as a single conditional
   `UPDATE ... WHERE revokedAt IS NULL`, closing a concurrent-reuse race)
2. **C-02** — `TRUST_PROXY` configuration added and wired via `app.set('trust proxy', ...)`
   before any middleware reads `req.ip`
3. **H-01** — `env.JWT_REFRESH_TTL` was validated but never actually used (hardcoded 7-day
   constant silently overrode it) — now genuinely wired through
4. **H-02** — email casing normalization was inconsistent between login and account creation —
   unified through the `Email` value object everywhere
5. **H-03** — `PrismaUserRepository.create()` silently created role-less users if a requested
   role name didn't resolve — now throws `RoleNotFoundError`
6. **H-04** — audit-log write failures could mask login results or fail an already-successful
   login — `IAuditLogger`'s contract now forbids throwing; `PrismaAuditLogger` catches and logs
   its own failures instead

**Work completed (final production-readiness review — 1 more Critical issue found and fixed):**
- **Transactional correctness gap:** `revoke()` + `issue()` were still two independent DB calls;
  a failure between them could permanently revoke a session with no replacement ever issued
  (accidental, unrecoverable logout from a transient error). Fixed by adding
  `IRefreshTokenRepository.rotate()`, implemented as a single `prisma.$transaction` — if the
  `create()` step fails, the whole transaction (including the revoke) rolls back, so the
  original token stays valid for a retry.
- `TRUST_PROXY` had no format validation of its own (a malformed value crashed inside Express
  with an unclear third-party error) — added `validateTrustProxy()`, using `proxy-addr.compile()`
  directly (the same function Express uses internally) for a guaranteed-correct, clear
  fail-fast check.
- Filled a real test-coverage gap: `LogoutUseCase`, `LogoutAllUseCase`, `GetCurrentUserUseCase`
  had zero dedicated unit tests despite real logic.

**Major files/modules introduced:** all of `app/backend/src/modules/identity/`, plus
`shared/middleware/requireAuth.ts`, `shared/middleware/validate.ts`,
`shared/database/prismaClient.ts`, `shared/config/duration.ts`, `shared/config/trustProxy.ts`,
`scripts/bootstrap-admin.ts`.

**Verification:** clean `tsc` build, clean ESLint, 59 unit tests passing (0 requiring a live
DB), 6 integration tests correctly skip without Postgres (opt-in via `RUN_INTEGRATION_TESTS=1`),
live server smoke tests confirming boot behavior, cookie handling, validation, auth guarding,
and the new fail-fast config paths all work correctly. **Declared production-ready for
Milestone 7** at the end of the review cycle (see §7).

---

## 3. Current Backend Status

### Database Schema
PostgreSQL via Prisma. **27 models, 17 enums.** Every enum value is directly evidenced in
legacy data or explicitly named in `PROJECT_RULES.md` — none were invented. UUID primary keys
throughout (`@default(uuid())`). Money fields use `Decimal(14,2)`; rates/percentages use
`Decimal(6,3)`. Table names are `snake_case` via `@@map`.

### Prisma Models (grouped by area)
| Area | Models |
|---|---|
| Identity & Access | `Branch`, `User`, `Role`, `UserRole`, `Permission`, `RolePermission`, `RefreshToken` |
| Loan Product | `LoanProduct`, `LoanProductVersion`, `PenaltyRule`, `FeeRule` |
| Borrower | `Borrower`, `BorrowerIncomeDetail`, `BorrowerGovernmentId`, `Address`, `IdentificationDocument`, `CharacterReference`, `CoBorrower`, `LoanAccountCoBorrower` |
| Loan Account & Ledger | `LoanAccount`, `LoanTransaction`, `RepaymentSchedule`, `AppliedFee` |
| Documents | `Attachment`, `DocumentTemplate`, `DocumentTemplateMapping` |
| Audit | `AuditLog` |

Notable design points: `LoanProduct` is a stable identity record; `LoanProductVersion` holds
the actual versioned, immutable rule set (self-referencing `previousVersionId` for full
lineage) — a `LoanAccount` always references a specific `LoanProductVersion`, never the mutable
`LoanProduct` directly. `Address` and `Attachment` use a polymorphic `ownerType`/`ownerId` pair
(no DB-level FK integrity — a known, documented trade-off). No financial ledger table
(`LoanTransaction`, `RepaymentSchedule`, `AppliedFee`) is reachable via any `ON DELETE CASCADE`
path — verified directly against the generated migration SQL.

### Migrations
Two migrations exist: `20260702000000_init` (the full initial schema) and
`20260702010000_schema_review_indexes_and_lpv2_guard` (16 indexes + the LPV-2 partial unique
index). **Both were generated/verified without a live PostgreSQL instance** — this dev
environment has never had Docker/Postgres available. Outstanding action item: run
`npx prisma migrate dev` once against a real Postgres to have Prisma itself confirm these
migrations through its normal shadow-database workflow (expected to be a no-op confirmation,
not a functional change).

### Authentication
Fully implemented (Milestone 6). JWT access tokens (HS256, 15-minute default TTL, claims:
`sub`, `email`, `roles`, `branchId`, `jti`). Refresh tokens are **opaque random strings** (64
bytes via `crypto.randomBytes`), **not JWTs** — hashed with HMAC-SHA256 keyed by
`JWT_REFRESH_SECRET` before storage (raw value never persisted, only returned once at
issuance). Rotate-on-use with atomic, transactional rotation and reuse detection (replaying an
already-rotated token revokes the entire session family). bcrypt cost factor 12 for password
hashing. See §5 for full rationale on each of these choices.

### Infrastructure Layer (identity module)
`BcryptPasswordHasher`, `JwtTokenService`, `PrismaUserRepository`, `PrismaRefreshTokenRepository`
(includes the transactional `rotate()` method), `PrismaAuditLogger` (non-throwing, per H-04).

### Shared Modules
| File | Purpose |
|---|---|
| `shared/config/env.ts` | Zod-validated, fail-fast environment config (single source of truth) |
| `shared/config/duration.ts` | Parses `"7d"`/`"15m"`-style duration strings to milliseconds |
| `shared/config/trustProxy.ts` | Parses + validates `TRUST_PROXY` (mirrors Express's own validation) |
| `shared/database/prismaClient.ts` | Singleton `PrismaClient` instance |
| `shared/errors/DomainError.ts` | Base error class (+ `NotFoundError`, `ValidationError`) with `httpStatus` |
| `shared/logger/logger.ts` | `pino` structured logger |
| `shared/middleware/errorHandler.ts` | Central Express error handler (`DomainError` → JSON + status) |
| `shared/middleware/requireAuth.ts` | JWT verification middleware, reusable by all future modules |
| `shared/middleware/validate.ts` | Generic Zod request-body validator |
| `shared/result.ts` | `Result<T,E>` type — **defined but not yet used anywhere** (see §8) |
| `shared/types/express.d.ts` | `Request.authUser` type augmentation |

### Testing
Vitest. **59 unit tests, 6 integration tests** (18 test files total; integration tests are
opt-in via `RUN_INTEGRATION_TESTS=1` and require a live Postgres, which this dev environment
never had — they currently always skip here but are believed correct and ready to run in CI).
Unit tests mock Prisma directly (`vi.mock('@shared/database/prismaClient', ...)`) — no test in
this project has ever actually executed against a real database. Test files live under
`app/backend/tests/unit/` (mirroring `src/`) and `tests/integration/`.

### Configuration
Single source of truth: `shared/config/env.ts`. All values Zod-validated at boot; the process
calls `process.exit(1)` with a clear message on any invalid/missing value — including two
custom validators added in Milestone 6 (`JWT_REFRESH_TTL` duration format, `TRUST_PROXY`
format via `proxy-addr`). `STORAGE_DRIVER`/`STORAGE_LOCAL_PATH` are validated but **not yet
consumed anywhere** — legitimate scaffolding for a document-storage feature not yet built, not
a bug (verified via grep).

### Logging
`pino`, structured JSON output. `pino-http` middleware logs every request/response. Log level
is `debug` in development, `info` in production (`error` only for Prisma's own query logging).

### Audit System
`AuditLog` table (append-only, no update/delete path exposed anywhere). `IAuditLogger` port
contract explicitly **forbids implementations from throwing** — `PrismaAuditLogger` catches its
own DB failures and reports them via the structured logger instead of propagating them into the
login/refresh critical path (finding H-04; see §5 for the full reasoning on why this is correct
for authentication specifically but should NOT be the pattern for financial transactions).

### Validation
Zod schemas at the `interface/http` boundary (`authSchemas.ts`), applied via the generic
`shared/middleware/validate.ts`. Email validation/normalization is routed through the `Email`
domain value object rather than duplicated Zod logic (finding H-02).

### Middleware (in `app.ts` application order)
`trust proxy` setting → `helmet()` → `cors()` → global rate limiter (300 req/15min) →
`express.json()` → `cookie-parser()` → `pino-http` request logger → `/health` route → identity
module wiring (includes a dedicated login-only rate limiter, 8 req/15min) → `/api/v1/auth`
router → `errorHandler` (must be last).

---

## 4. Current Frontend Status

**What exists:** a minimal Vite + React + TypeScript + Tailwind scaffold. `main.tsx` wires
`QueryClientProvider` (TanStack Query) and `BrowserRouter` (React Router) around a placeholder
`App.tsx` that renders a single "EasyCash Digital Lending Platform" landing message with a
catch-all route. `tailwind.config.ts`, `postcss.config.js`, `vite.config.ts` are configured and
working (verified: `npm run build` succeeds, produces a small production bundle).

**What is intentionally unfinished (everything else):**
- No real routes/pages for any feature
- No `features/` directory content (the intended pattern is to mirror backend module
  boundaries, per the original Milestone 1 architecture plan, but nothing has been built)
- No Shadcn UI components installed or configured yet
- No API client / `lib/` HTTP wrapper
- No authentication integration on the frontend at all (no login form, no token storage
  strategy implemented) — the backend's design assumes the access token is held in memory only
  (never `localStorage`) and refreshed via the HttpOnly cookie on page load; this is documented
  intent, not implemented code
- No dark/light mode, no responsive layout work, no accessibility work

This is all explicitly Milestone 9 scope per the original Phase 2 plan (Authentication was
Milestone 6; APIs for other modules is Milestone 8; Frontend is Milestone 9).

---

## 5. Architecture Decisions

**Clean Architecture:** domain/application/infrastructure/interface layering per module,
mechanically enforced for the two inner layers via a scoped ESLint rule. Composition root
(`app.ts`) is the single wiring point. Chosen over simpler patterns given the project's stated
multi-year maintenance horizon.

**DDD boundaries:** 8 bounded-context modules mapped to the (unpersisted) Phase 1 Core Domain
Model's aggregates. Only `identity` is built; the rest are scaffolded folders.

**JWT strategy:** HS256, single monolith verifies its own tokens (no need for RS256's
asymmetric key distribution yet). 15-minute default access-token TTL — short enough to limit
exposure if leaked, since access tokens cannot be revoked before natural expiry (an accepted,
standard trade-off of stateless JWTs). No `iss`/`aud` claims yet (deferred until a second
token-consuming service exists).

**Refresh-token strategy:** deliberately **opaque random strings, not JWTs** — refresh tokens
are always redeemed against the database anyway, so making them stateful (a DB row) is what
makes rotation, revocation, and reuse detection possible and reliable, avoiding the classic
"can't truly revoke a stateless JWT before expiry" problem. Stored as
`HMAC-SHA256(rawToken, JWT_REFRESH_SECRET)` — deterministic (supports the `tokenHash @unique`
index for O(1) lookup, unlike bcrypt's salted output) and keyed (a pepper — DB exfiltration
alone isn't enough to forge a matching hash).

**Session revocation:** three distinct operations on `IRefreshTokenRepository`: `revoke(id)`
(single atomic conditional `UPDATE ... WHERE revokedAt IS NULL`, returns whether *this* call
won — used by logout and reuse-detection's "kill everything" response), `revokeAllForUser`
(logout-all / reuse response), and `rotate(oldId, newToken)` (the transactional revoke+issue
used specifically for refresh — see the production-readiness review finding above for why this
had to become a single `prisma.$transaction` rather than two separate calls).

**Password hashing:** bcrypt, cost factor 12 (hardcoded constant, not env-configurable —
changing it later requires a re-hash-on-next-login migration strategy, explicitly out of scope
for now). A fixed, valid dummy bcrypt hash is compared against even for unknown-email login
attempts, so response timing doesn't reveal whether an account exists (paired with returning
the *same* `InvalidCredentialsError` for both "unknown email" and "wrong password").

**Email normalization:** single source of truth is the `Email` domain value object
(`identity/domain/Email.ts`) — `create()` validates + normalizes (trim + lowercase), `normalize()`
normalizes only (for defensive re-normalization at repository boundaries without re-validating
already-trusted input). Used at the login Zod schema, both read and write paths in
`PrismaUserRepository`, and `bootstrap-admin.ts`. This prevents case-variant duplicate accounts
and login failures caused by casing mismatches (finding H-02).

**Audit logging strategy:** `IAuditLogger.log()` must never throw — a failure here is reported
via the structured logger, not propagated. Rationale (reasoned through explicitly in the
production-readiness review): authentication events are not financial transactions; failing
closed would let a transient audit-infrastructure hiccup lock out a legitimate user, which is a
worse outcome than a temporarily-incomplete `audit_logs` row for an event still captured in
application logs. **This reasoning does NOT extend to financial transactions** — Milestone 7+
work involving the ledger (`LoanTransaction`, etc.) should likely use the *opposite* pattern
(wrap the financial write and its audit entry in one transaction, fail closed) since an
unaudited financial state change is arguably worse than not making it. **A formal ADR
documenting this distinction was recommended but not yet created** — see §6 and §12.

**Configuration validation:** `shared/config/env.ts` is the single source of truth, Zod-backed,
fail-fast (`process.exit(1)`) on any invalid value. Two custom validators were added in
Milestone 6 specifically because generic Zod string validation wasn't sufficient:
`parseDurationMs` (for `JWT_REFRESH_TTL`) and `validateTrustProxy` (for `TRUST_PROXY`, which
reuses Express's own `proxy-addr.compile()` internally rather than a hand-rolled, potentially
incorrect regex — especially important for IPv6 correctness).

**Prisma conventions:** UUID PKs; `snake_case` `@@map` table names; explicit `Decimal`
precision for all money/rate fields; nullable unique `legacyId` columns on legacy-mapped
entities for future migration traceability (without a full crosswalk table yet — YAGNI until a
migration phase actually starts); extensive `///` doc comments tracing every model/field to a
Phase 1.5 rule ID or ADR. **One sharp edge learned the hard way:** a `///` comment containing a
literal `*/` will corrupt the generated Prisma Client's TypeScript (it prematurely closes the
generated JSDoc block) — this happened once (a comment mentioning `tax_*/organization-commission`)
and was fixed by adding spaces around the asterisk. Watch for this in any future schema comment.

**Migration strategy:** Prisma Migrate. Because no live PostgreSQL has ever been available in
this dev environment, every migration so far was generated via `prisma migrate diff` and
manually cross-verified against Prisma's own diff output, rather than via the normal
`prisma migrate dev` shadow-database workflow. This is flagged as an outstanding action item in
every relevant section — the first time this project runs against a real Postgres instance,
run `prisma migrate dev` once to have Prisma confirm these migrations natively.

---

## 6. ADR Status

The full Architecture Decision Register (41 ADRs, each with description/options/risks/owner/
priority) was produced during the Phase 1 planning conversation but **was never persisted to a
file** — see the caveat at the top of this document. What follows is a status summary
reconstructed from that work, sufficient to know what's settled vs. still open. IDs are
preserved for traceability with schema comments (`schema.prisma` cites several of these
directly).

### Resolved / Adopted (recommended option implemented in code)
| ADR | Title | Where adopted |
|---|---|---|
| ADR-001 | Borrower vs. Client terminology → "Borrower" is canonical | `schema.prisma` model naming |
| ADR-002 | No retroactive reconstruction of legacy product-version history | `LoanProductVersion` design |
| ADR-003 | Full Loan Product Version lineage (self-referencing) | `LoanProductVersion.previousVersionId` |
| ADR-005 | Branch — seed one provisional "Head Office" row | `prisma/seed.ts`, resolved via explicit user direction during Milestone 6 planning |
| ADR-011 | Loan Account lifecycle — lean, legacy-observed state set | `LoanAccountStatus` enum |
| ADR-014 | Address polymorphism (Borrower or Co-Borrower) | `Address.ownerType`/`ownerId` |
| ADR-028 | Drop unused legacy tax_*/funder fields from Repayment | `RepaymentSchedule` model (fields omitted) |
| ADR-033 | Split "Repayment" into schedule vs. transaction concepts | `RepaymentSchedule` vs. `LoanTransaction` |
| ADR-039 | No legacy credential migration | `bootstrap-admin.ts` creates fresh accounts only |

### Pending — Critical / Compliance-Sensitive (resolve before touching related features)
| ADR | Title | Status detail |
|---|---|---|
| ADR-010 | Add-On vs. Contractual Interest Rate definitions | Columns exist on `LoanAccount` (`addOnInterestRate`, `contractualInterestRate`), no derivation/disclosure logic anywhere. Truth-in-Lending-equivalent compliance risk. |
| ADR-004 | Group-held loans out of scope | Explicitly documented as deferred in `schema.prisma` header + `LoanAccount` comment (Schema Review finding SR-01) |

### Pending — Mechanism Exists, Policy Not Decided
| ADR | Title | Status detail |
|---|---|---|
| ADR-007 | Outstanding Balance formula | No stored column by design; formula not yet standardized across sources |
| ADR-008 | Penalty cap enforcement | `PenaltyRule.capPercent` column exists, not enforced by any code yet |
| ADR-009 | Repayment allocation order | `LoanProductVersion.repaymentAllocationOrder` (Json) exists, no value/logic implemented |
| ADR-015 | Co-Borrower ownership scope (per-borrower vs. per-loan) | Schema uses a join table (`LoanAccountCoBorrower`) as a safe extension point compatible with either resolution |
| ADR-032 | Loan Release vs. Disbursement | Schema takes a working assumption (two distinct moments), explicitly NOT a resolution — documented inline |

### Pending — Deferred, Not Yet Relevant (no code touches these areas yet)
ADR-006 (Attachment file storage), ADR-012 (Borrower duplicate matching), ADR-013 (Character
Reference requirement), ADR-016 (CIC automation), ADR-017 (Data retention/consent), ADR-018
(Mambu/SDevTech frozen or live), ADR-019 (legacy penalty write-off), ADR-020 (MLR/SOA
reconciliation), ADR-021 (loan code prefix taxonomy), ADR-022 (SDevTech vendor dependency),
ADR-023 (deprecated product reactivation), ADR-024 (maker-checker approval), ADR-025
(`custom_fields` definitions), ADR-026 (empty legacy collections), ADR-027 (`client_types`
semantics), ADR-029 (minimum KYC checklist), ADR-030 (aging buckets), ADR-031 (past-due/arrears
threshold), ADR-034 (SOA reconciliation), ADR-035 (Collection Fee confirmation), ADR-036
(reopen-closed-loan process), ADR-037 (PSGC address normalization).

### Deferred by Explicit Scope Decision
| ADR | Title | Detail |
|---|---|---|
| ADR-038 | RBAC / permission matrix design timing | Explicitly deferred — Milestone 6 was scoped to Authentication only, no Authorization. `requireAuth` verifies identity and attaches role *names* to the request context, but no `requirePermission` guard exists anywhere yet. |
| ADR-040 | Guarantor entity | Named in `PROJECT_RULES.md` but not modeled; documented as deferred in `schema.prisma` header |
| ADR-041 | Restructuring/Renewal/Write-off/Early-Settlement/Holiday-Rule structures | Named in `CLAUDE.md`/`PROJECT_RULES.md` but not modeled; documented as deferred in `schema.prisma` header |

### Introduced or Updated During Milestone 6
- **ADR-004 and ADR-032** were not new, but the Schema Review follow-up added explicit
  `schema.prisma` comments for them where previously only the ADR register (unpersisted)
  captured the decision.
- **A new ADR was recommended but not yet formally created**: *"Audit Logging Failure Isolation
  — Authentication vs. Financial Transactions"* — capturing the H-04 reasoning (fail-open for
  auth, should likely fail-closed for financial transactions) as a durable decision before
  Milestone 7 starts writing financial ledger entries. **Action item for whoever picks this up
  next: formally create this ADR** (see §12).

---

## 7. Security Status

### Implemented Protections
- bcrypt password hashing (cost 12)
- JWT access tokens (HS256, 15-min TTL, algorithm explicitly pinned on verify to prevent
  algorithm-confusion attacks)
- Refresh tokens: opaque, HMAC-hashed at rest, atomic rotate-on-use, reuse detection revokes
  the entire session family, transactionally safe against partial failures
- Refresh-token cookie: `HttpOnly`, `Secure` (production), `SameSite=Strict`, path-scoped to
  `/api/v1/auth` — never returned in a JSON response body
- Access token held client-side in memory only by design (never `localStorage`) — a documented
  intent for the not-yet-built frontend, not enforced by backend code
- Helmet security headers, explicit-origin CORS with credentials
- Global rate limiting (300/15min) + dedicated login rate limiting (8/15min)
- `TRUST_PROXY` configurable and validated — prevents both under-trusting (which would collapse
  the rate limiter into one global bucket behind a real proxy) and accidental over-trusting
- Generic "Invalid email or password" message + constant-time-ish dummy-hash comparison for
  unknown emails (timing/enumeration mitigation)
- Consistent email normalization prevents case-variant duplicate accounts
- Fail-fast configuration validation for every security-relevant env var
- Audit logging for login success/failure (best-effort, non-blocking — see §5)
- No default admin account, no secrets committed to the repository

### Remaining Accepted Risks
- No per-account login lockout — only IP-based rate limiting (a distributed attacker with many
  IPs could still attempt credential stuffing against one account without being IP-rate-limited)
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are independently validated (≥32 chars) but not
  enforced to be *distinct* from each other
- No `iss`/`aud` claims on access tokens (low risk for a single monolith today)
- Access tokens cannot be revoked before their natural 15-minute expiry — standard,
  accepted trade-off of stateless JWTs
- `TokenReuseDetectedError`'s client-facing message may be more informative to a would-be
  attacker than strictly necessary
- Rotated refresh tokens don't carry `createdByIp` forward from the original login (only the
  first token in a session's lineage has it) — forensic completeness gap, not a security hole

### Deferred Security Improvements
- **Authorization/permission enforcement** — entirely absent. `requireAuth` only verifies
  identity; there is no `requirePermission` middleware or route-level permission checking
  anywhere in the codebase yet. This is the single most important deferred item before any real
  business endpoint (Milestone 7+) can be safely exposed.
- Password reset / MFA / SSO — not built, no evidence in the spec that they're required yet
- `bcrypt`'s transitive dependency chain (`@mapbox/node-pre-gyp` → `tar`) carries some
  install-time-only advisories per `npm audit` (not remotely exploitable via the running API);
  a `bcrypt@6.0.0` upgrade is available but untested against this codebase

### Production Readiness Conclusion
The authentication module was explicitly declared **production-ready for Milestone 7** at the
end of the Milestone 6 audit + production-readiness review cycle. This conclusion is scoped
strictly to *authentication* — it says nothing about the security posture of features that
don't exist yet (borrower management, loan processing, etc.), and explicitly assumes
Authorization will be built before any of those features are exposed without protection.

---

## 8. Remaining Technical Debt

### High
- **No Authorization/permission-enforcement layer.** `requireAuth` verifies identity only.
  Deferred by explicit Milestone 6 scope decision, but this must be built before Milestone 7+
  exposes any real business endpoint without protection beyond "is this token valid."
- **ADR-010 (Add-On vs. Contractual Interest) unresolved.** Compliance-critical (Truth-in-Lending-
  equivalent risk) — deferred because it requires a business/legal decision this project cannot
  make unilaterally, but it blocks any future interest-rate disclosure feature.
- **ADR-004 (Group-held loans) unresolved.** Deferred because no evidence exists yet on whether
  group lending is still an active product line; the schema deliberately supports individual
  Borrower-held loans only for now.

### Medium
- **`RefreshToken.userId` has no database index.** Flagged in the original post-implementation
  audit (finding M-03) but explicitly excluded from the "blocking findings only" fix scope the
  user requested — `revokeAllForUser` and any future session-listing query will full-scan this
  table as it grows. Deferred because it wasn't blocking and the table is still small.
- **Several actor-reference foreign keys use `ON DELETE SET NULL`** (`loan_transactions
  .postedByUserId`, `loan_accounts.approvedByUserId`/`loanOfficerId`, `audit_logs.userId`, etc.)
  — deleting a `User` row would silently blank out historical attribution on financial/audit
  records. Deferred because `User` already has a proper deactivation path (`UserStatus`) and
  should never actually be hard-deleted in practice; the risk is latent, not active.
- **No per-account login lockout**, only IP-based rate limiting (see §7). Deferred per the
  original Milestone 6 plan's Assumption #4 — would require a schema change (two new columns
  on `User`) that was out of scope for the audit-fix-only pass.
- **`Address`/`Attachment` polymorphic ownership has no database-level referential integrity**
  (no FK constraint, no cascade) — a known, common trade-off for polymorphic associations in a
  relational schema, since Prisma doesn't support them natively. Deferred because fixing it
  would require either an application-layer integrity-check convention or restructuring away
  from polymorphism, neither of which was in scope for any pass so far.
- **A new ADR documenting the audit-failure-isolation reasoning (§5, §6) has not yet been
  formally created**, despite being explicitly recommended. Deferred simply because no one has
  done it yet — it's a documentation task, not a code change.

### Low
- **`uuid` npm package is an unused dependency** (confirmed via grep — nothing imports it;
  Milestone 6 uses `node:crypto`'s built-in `randomUUID` instead). Also the source of a
  moderate `npm audit` finding. Deferred because it's cosmetic cleanup, not a functional issue.
- **bcrypt cost factor (12) is hardcoded**, not env-configurable. Deliberate — changing it
  later requires a re-hash-on-next-login migration strategy, explicitly out of scope for now.
- **`shared/result.ts`'s `Result<T,E>` type is defined but not used anywhere.** Established in
  Milestone 3 as the intended pattern for expected business-rule failures, but Milestone 6's
  use cases all throw typed `DomainError` subclasses instead (a valid, working alternative
  pattern). Deferred because both patterns work; whether to actually adopt `Result` project-wide
  is an open question for whoever builds the next module.
- **`TokenReuseDetectedError`'s message may be more informative than necessary** (§7). Low-risk
  judgment call, not fixed because it's a minor hardening nicety, not a real vulnerability.
- **No `iss`/`aud` claims on JWTs.** Deferred because it only matters once a second
  token-consuming service exists — premature to add now.
- **`bcrypt@6.0.0` upgrade not yet done/tested** (§7). Deferred because it's flagged as a
  breaking change by npm and the install-time-only advisories it addresses aren't remotely
  exploitable via the running API — not urgent, but should be tracked.

---

## 9. Current Folder Structure

```
app/
  README.md                  — how to run the app locally, deployment assumptions (TRUST_PROXY)
  package.json                — npm workspaces root
  docker/
    docker-compose.yml         — postgres + backend + frontend services
    backend.Dockerfile
    frontend.Dockerfile
  backend/
    prisma/
      schema.prisma             — 27 models, 17 enums, extensively commented
      seed.ts                    — Branch/Role/Permission baseline only, no default admin
      migrations/
        20260702000000_init/
        20260702010000_schema_review_indexes_and_lpv2_guard/
    scripts/
      bootstrap-admin.ts        — guarded first-admin creation CLI
    src/
      app.ts                    — composition root (all wiring happens here)
      server.ts                  — entrypoint, graceful shutdown
      modules/
        identity/                — FULLY BUILT (Milestone 6)
          domain/                  Email.ts, PasswordPolicy.ts
          application/             ports/, use-cases/, dtos/, errors/
          infrastructure/          Bcrypt/Jwt/Prisma* adapters
          interface/http/          controller, router, schemas, cookies
        borrower/                — scaffolded only (.gitkeep placeholders)
        loan-product/             — scaffolded only
        loan-account/             — scaffolded only
        ledger/                   — scaffolded only
        repayment/                — scaffolded only
        document/                 — scaffolded only
        audit/                    — scaffolded only
      shared/
        config/                  env.ts, duration.ts, trustProxy.ts
        database/                prismaClient.ts (singleton)
        errors/                  DomainError.ts
        logger/                  logger.ts (pino)
        middleware/              errorHandler.ts, requireAuth.ts, validate.ts
        types/                   express.d.ts
        result.ts                Result<T,E> — defined, not yet used
    tests/
      unit/                      mirrors src/, 59 tests, no DB required
      integration/               auth.test.ts, 6 tests, opt-in (RUN_INTEGRATION_TESTS=1)
  frontend/
    src/
      App.tsx, main.tsx, index.css, vite-env.d.ts   — placeholder shell only
      (routes/, features/, components/ui/, lib/, hooks/ all exist as empty dirs, unbuilt)

docs/                          — EMPTY except this file (see caveat at top of document)
  Architecture/
  Legacy Analysis/
  Reports/
  SRS/

legacy/                        — REFERENCE ONLY, never modified
  mongodb/, reports/, website/, sdevtech/
```

---

## 10. Coding Standards

- **Naming:** PascalCase for classes/types/interfaces (interfaces prefixed `I` for ports, e.g.
  `IUserRepository`); camelCase for functions/variables; error classes always end in `Error`
  and extend `DomainError`; Prisma models are PascalCase, mapped to `snake_case` tables via
  `@@map`.
- **Layering:** strict Clean Architecture — `domain/` and `application/` never import from
  `infrastructure/` or `interface/` (mechanically enforced by a scoped ESLint rule). Ports
  (interfaces) are defined in `application/ports/`, implemented in `infrastructure/`.
- **Dependency direction:** always inward. `interface → application → domain ← infrastructure`.
  The composition root (`app.ts`) is the only place concrete infrastructure classes are
  instantiated and wired into use cases.
- **Testing:** Vitest. Unit tests mock all ports/Prisma directly — no test in this project has
  ever required a live database. Integration tests exist for full HTTP round-trips but are
  opt-in (`RUN_INTEGRATION_TESTS=1`) since this dev environment has no Postgres/Docker. Every
  new use case or repository method should get a dedicated test file — this was a real,
  identified gap in Milestone 6 (3 use cases had zero coverage until the production-readiness
  review caught it).
- **Error handling:** business-rule violations are typed `DomainError` subclasses (never plain
  `Error` or generic exceptions) carrying a `code`, optional `ruleId` (tracing back to a Phase
  1.5 rule ID), and `httpStatus`. Thrown, not returned — caught centrally by `errorHandler`.
  Infrastructure adapters are allowed to throw application-layer error types (this is correct
  Clean Architecture, not a violation — the port's *contract* includes its error cases).
- **Logging:** `pino` everywhere, structured (never `console.log` in application code — the one
  exception is `bootstrap-admin.ts`, a CLI script, which uses `console.log`/`console.error`
  deliberately with `eslint-disable no-console`).
- **Migrations:** every migration file should be reviewable, hand-inspectable SQL. In this
  environment (no live Postgres), migrations are generated via `prisma migrate diff` and
  manually cross-verified — the moment a real Postgres is available, switch to
  `prisma migrate dev` as the primary workflow.
- **Prisma usage:** always import the shared singleton (`@shared/database/prismaClient`), never
  construct a new `PrismaClient` elsewhere (would exhaust the connection pool). Use
  `Prisma.UserGetPayload<{...}>`-style derived types when a repository needs a shape based on an
  `include`, never hand-write a type that could drift from the actual query shape.
- **Validation:** Zod at the `interface/http` boundary only, via the generic
  `shared/middleware/validate.ts`. Domain-level validation (e.g. email format) lives in the
  domain value object it concerns (`Email.create()`), not duplicated in the Zod schema.
- **Comments:** default to none. When present, they explain *why* (a non-obvious constraint, a
  workaround, a traced rule ID), never *what* (the code already says that). Every schema field
  tied to a business rule cites its rule ID or ADR. **Never put a literal `*/` inside a Prisma
  `///` doc comment** (see §5 — it corrupts codegen).
- **Commit philosophy:** commit after every milestone or audit-fix cycle, with a detailed
  message explaining *why*, not just *what*. Every commit in this project's history so far
  documents its own verification (build/lint/test results) in the message body. Never amend
  published commits; never force-push; never skip hooks.

---

## 11. Verification History

As of the end of Milestone 6 (commit `e90cc88`), re-verified fresh for this handoff document:

| Check | Result |
|---|---|
| Backend build (`tsc` + `tsc-alias`) | ✅ Clean, zero errors |
| Backend ESLint | ✅ Clean, zero errors/warnings |
| Backend unit tests | ✅ 59 passing, 0 failing |
| Backend integration tests | ⏭️ 6 correctly skip (no live Postgres in this environment; opt-in via `RUN_INTEGRATION_TESTS=1`) |
| Frontend build (`tsc -b` + `vite build`) | ✅ Clean |
| `prisma format` / `prisma validate` / `prisma generate` | ✅ All pass |
| Live server smoke test | ✅ Boots correctly, `/health` returns 200, auth routes reachable, validation/auth-guard/config-fail-fast paths all behave correctly |
| Production-readiness review (6-point: transactional, security, audit, architecture, config, testing) | ✅ Complete — found and fixed 1 additional Critical issue (transactional rotation) and 1 config-validation gap before declaring the module ready |

**Persistent limitation across the entire project so far:** no live PostgreSQL or Docker has
ever been available in this development environment. Every database-dependent claim (schema
validity, migration correctness, integration test behavior) has been verified through the
strongest means available without one — `prisma validate`/`generate`, byte-for-byte comparison
against `prisma migrate diff` output, and mocked-Prisma unit tests — but **none of it has been
confirmed against a real running Postgres instance yet.** This is the single most important
outstanding verification gap. The first time this project runs in an environment with Docker/
Postgres, running `docker compose up`, `prisma migrate dev`, `prisma db seed`, and the full
integration test suite (`RUN_INTEGRATION_TESTS=1 npm run test`) should be treated as a required
checkpoint, not an optional nicety.

---

## 12. Recommended Next Step

**Milestone 7** was originally scoped (per the Phase 2 development order) as **Core Domain
Models** — building out the domain/application layers for the remaining bounded contexts
(`borrower`, `loan-product`, `loan-account`, `ledger`, `repayment`) that are currently only
empty folder scaffolds.

### What Milestone 7 can safely assume, based on completed work
- The Clean Architecture pattern, folder structure, and ESLint enforcement are established and
  working — new modules should follow the exact same 4-layer shape as `identity`.
- `shared/` utilities (`env`, `logger`, `errorHandler`, `DomainError`, `prismaClient`,
  `requireAuth`) are ready to reuse as-is.
- The database schema for these domains already exists in full (Milestone 4) — Milestone 7 is
  about writing domain entities, use cases, and repositories *against* the existing schema, not
  designing new tables (aside from anything ADR resolutions might require).
- `requireAuth` can gate any new endpoint's *authentication*, but there is still no
  authorization layer — any new protected endpoint currently can only check "is this user
  logged in," not "is this user allowed to do this."

### What must happen before or very early in Milestone 7
1. **Resolve or explicitly re-defer, with a documented decision, at least ADR-010** (Add-On vs.
   Contractual Interest) if Milestone 7 touches `LoanAccount` interest fields at all — this is
   the one compliance-critical open item most likely to be touched by "Core Domain Models" work.
2. **Formally create the recommended new ADR** ("Audit Logging Failure Isolation — Auth vs.
   Financial") **before** any financial-transaction-writing code is built, since Milestone 7's
   `ledger`/`repayment` modules are exactly where the fail-open-vs-fail-closed distinction
   matters. Recommendation: financial writes should wrap their audit log entry in the *same*
   database transaction as the financial state change itself (opposite of the `identity`
   module's pattern), so an unaudited financial change can never be committed.
3. **Decide whether Authorization is built now or still deferred.** If Milestone 7 exposes any
   real HTTP endpoint for borrower/loan data, it needs *some* permission check beyond
   `requireAuth`, even if minimal — otherwise every authenticated user could do everything.
4. **If time allows, formally persist `docs/Architecture/ADR_REGISTER.md` and
   `docs/Architecture/DOMAIN_GLOSSARY.md`** as standalone files (see the caveat at the top of
   this document) — right now this handoff document is the only place any of that
   Phase 0/Phase 1 work survives outside chat history, which is a fragile position for a
   project expected to span many more milestones.
5. Before trusting anything database-dependent in the new modules, get a real PostgreSQL
   instance running (`docker compose up postgres` — Docker has simply never been available in
   this dev environment) and run `prisma migrate dev` + the full test suite against it once, to
   close the verification gap noted in §11.
