# ADR-044 — Separate Customer Identity Model for the Future Public Loan Application Portal

**Status:** Accepted (architecture review, 2026-07-03) — decision only, implementation not started
and not scheduled by this document.
**Context documents:** `PROJECT_RULES.md` (Future Modules — "Online Loan Application Portal",
"Customer Self-Service Portal"); `docs/Architecture/ADR-042-aggregate-boundaries.md` (aggregate
reference discipline this decision extends); `docs/Architecture/ADR-043-interim-role-based-
authorization.md` (the internal authorization model this decision deliberately does not reuse for
customers); `app/backend/src/modules/identity/application/ports/ITokenService.ts` (current
`AccessTokenClaims` shape, evidence for §2); `app/backend/prisma/schema.prisma` `User`/`Role`/
`Branch` models (evidence for §2).
**Relationship to other ADRs:** does not supersede or modify ADR-042, ADR-043, or ADR-038 (still
open). Extends ADR-042's "aggregates reference each other by ID only" discipline to a new kind of
principal, and narrows ADR-038's eventual scope by pre-deciding that a permission matrix, whenever
it is designed, governs internal staff authorization only — not customer authentication.

---

## 1. Decision

**When the Public Loan Application Portal is built, its customer/applicant principals will be
modeled as a distinct identity concept, never as rows in, or an extension of, the existing internal
`User`/`Role` identity model.** The two principal types — internal staff and public
customers/applicants — are different in kind, not merely different in role, and must remain
architecturally separate: separate identity representation, separate authentication mechanism, and
a token/claims shape that does not assume every authenticated caller is scoped to a `Branch`.

This decision is scoped narrowly: it settles *that* the two identity models must be separate and
*why*. It deliberately does not settle the concrete shape of the future customer identity model
(what fields, what table, what token format) — that is Portal-milestone design work, not this
ADR's job (see §4).

---

## 2. Why this decision is needed now, evidenced from the current codebase

Direct inspection of the current implementation shows the internal identity model is staff-only by
construction, not by convention that could be quietly stretched later:

- `AccessTokenClaims` (`ITokenService.ts`) is `{ sub, email, roles, branchId, jti }` —
  `branchId` is a **required** field. A JWT issued by the current `JwtTokenService` cannot
  represent a principal who does not belong to an internal `Branch`.
- `shared/http/branchScope.ts`'s entire model (`GLOBAL_ROLES`, `resolveBranchScope`,
  `assertBranchAccess`, `resolveWriteBranchId`) assumes every authenticated caller is staff scoped
  to exactly one branch, or globally scoped staff (`MIS` — renamed 2026-07-06 from `Administrator`
  per `ADR-038` §1/§3.2; this ADR's underlying point is unaffected by the rename).
- The seeded `Role` rows (MIS, Loan Operation Manager, CRM, Finance, Accounting, Collection
  Officer, per `ADR-038` §1 — renamed 2026-07-06 from the original Administrator/Manager/Loan
  Officer/Cashier/Collection Officer/Viewer list `docs/PROJECT_HANDOFF.md` describes) are all
  internal job titles. No customer/applicant role exists, and none of these roles is a sensible
  fit for a customer principal.
- `Borrower` — the closest existing concept to "a customer" — is created **by staff**
  (`ORIGINATION_ROLES` gate on `POST /borrowers`) and has no linked login credential of any kind.
  A `Borrower` row today has no way to authenticate as itself.

**The risk this ADR heads off:** without a deliberate decision made now, the path of least
resistance under future implementation pressure would be to either (a) fabricate a placeholder
`branchId`/role for every public applicant to force-fit the existing claims shape, silently
corrupting the "branch = internal org unit" invariant everywhere else in the system that currently
relies on it, or (b) bypass `requireAuth` entirely for portal routes and improvise a second,
undocumented authentication mechanism ad hoc. Both outcomes were identified as real risks during
the 2026-07-03 architecture review of portal-readiness; this ADR exists to make sure neither
happens by default.

---

## 3. Why separate identity models, not a unified `User` table with a type discriminator

A unified table (e.g. `User.userType: 'STAFF' | 'CUSTOMER'`) was considered and rejected:

- **Different lifecycle and trust level.** Staff accounts are provisioned by an administrator,
  tied to a `Branch`, and carry role-based authorization over internal operations. Customer
  accounts, whenever they exist, will be self-registered or created from a `Borrower`/application
  record, carry no branch or internal role, and must never be reachable by the internal
  `requireRole`/`branchScope` machinery — a bug that let a customer session pass through
  `requireRole('MIS', ...)` by accident would be a severe security failure, not a cosmetic one.
- **Different growth trajectory.** Internal staff count is small and stable (bounded by branch
  headcount). Customer/applicant count is the platform's actual scale target (10,000+ borrowers
  per `CLAUDE.md`) and will eventually need its own independent concerns (self-service password
  reset, email/SMS verification, KYC document upload) that have no analog in the staff model and
  should not bloat it.
- **Precedent already established in this codebase.** `ADR-042` already draws exactly this kind of
  distinction for aggregates — `Borrower` and `CoBorrower` are kept as separate, independently-
  identified aggregates specifically because conflating two conceptually different kinds of person
  into one model would "silently pre-decide" a design question that belongs to a later, dedicated
  decision (`ADR-042` §3). The same reasoning applies here: collapsing staff and customer identity
  into one table now would silently pre-decide the Portal's authentication design before it has
  been properly scoped.

A unified table optimizes for schema convenience at the cost of conflating two principals with
fundamentally different trust boundaries — the wrong trade-off for a lending platform, per
`CLAUDE.md`'s security-first posture.

---

## 4. What this ADR does NOT decide

Deliberately left open, to be resolved as real Portal-milestone design work, not guessed at here:

- The concrete schema for the customer identity model (new table name, fields, relationship to
  `Borrower`).
- The authentication mechanism for customers (JWT vs. session, password vs. passwordless/OTP,
  whether it reuses `ITokenService` with a different claims shape or is a wholly separate
  mechanism).
- Whether a customer account is created at application-submission time, at approval time, or
  self-registered independently of any loan application.
- Whether the Portal is served by a second composition root in the existing `backend` workspace, a
  separate deployable, or some other topology — the 2026-07-03 architecture review noted the
  existing composition-root pattern (`app.ts`) already makes a second composition root cheap when
  the time comes, but that is an implementation choice for the Portal milestone, not this ADR.
- Any change to `Permission`/`RolePermission` or ADR-038's eventual full permission-matrix design —
  this ADR only establishes that whatever ADR-038 eventually decides governs **internal**
  authorization, not customer authentication.

---

## 5. Consequences

- **No code, schema, route, or claim changes result from this ADR.** `requireAuth`, `requireRole`,
  `branchScope.ts`, `AccessTokenClaims`, and `schema.prisma` are unchanged and unaffected.
- **Future Portal design work starts from a settled premise**, not a blank page under time
  pressure: the customer identity model will be new and separate, not an extension of `User`.
- **Milestone 9.1 (CP1–CP12) is entirely unaffected.** None of those checkpoints touch identity,
  authentication, or the HTTP layer — this ADR does not gate, reorder, or add work to any of them.
