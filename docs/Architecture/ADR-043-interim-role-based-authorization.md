# ADR-043 — Interim Role-Based Authorization for Milestone 8

**Status:** Accepted (Milestone 8 design review, 2026-07-02)
**Context documents:** `docs/PROJECT_HANDOFF.md §7` (ADR-038 status), `PROJECT_RULES.md §User Roles`
**Relationship to ADR-038:** ADR-038 ("RBAC / permission matrix design timing") is not resolved by
this ADR — it remains open. This ADR resolves only the narrower question of what gates
Milestone 8's HTTP endpoints *right now*, so that Milestone 8 does not ship unprotected business
endpoints while waiting for ADR-038's full design to be settled.

## 1. Decision

Milestone 8 introduces `requireRole(...roleNames)`, a minimal Express middleware that checks the
already-authenticated request's JWT `roles` claim (`AccessTokenClaims.roles: string[]`, populated
since Milestone 6) against an explicit, route-declared allow-list. If the current user holds none
of the named roles, the request is rejected with a 403 `ForbiddenError` before any use case runs.

This is deliberately **not**:
- A permission matrix (no `Permission`/`RolePermission` database lookup at request time, despite
  that schema already existing — AUDIT-3's "configurable permissions, no hard-coded role checks"
  goal is explicitly NOT met by this ADR).
- A policy engine (no rule composition, no resource-level or attribute-based checks).
- Dynamic (the allow-list per route is a hard-coded array in the router file, not configurable
  without a code change and redeploy).

## 2. Why this, and not the full permission matrix, now

Milestone 7's own handoff notes flagged authorization as "the single most important deferred item
before any real business endpoint can be safely exposed" — a real risk, but not one that requires
building AUDIT-3's full configurable-permissions design to close. The database schema, JWT claim
shape, and seeded role data needed for a role check already exist from Milestones 4–6; nothing
about role-checking requires new schema, new claims, or new infrastructure. Building the full
permission matrix (dynamic per-role permission assignment, checked against the `Permission`/
`RolePermission` tables at request time) is a materially larger design effort — it needs its own
requirements pass (what are the actual permissions? who assigns them? how fine-grained?) that
Milestone 8, whose stated objective is "expose the existing application layer through a Clean
Architecture HTTP interface," should not absorb. Building it now would turn an interface-layer
milestone into a second authorization-design milestone, which is explicitly out of scope per the
Milestone 8 approval.

## 3. What this interim decision costs

- Role allow-lists are hard-coded per route (e.g. `requireRole('Administrator', 'Manager')` on a
  loan-approval endpoint) — changing who can call an endpoint requires a code change, not a data
  change, even though `Role`/`Permission` rows already exist in the database for exactly this
  purpose.
- No resource-level or field-level authorization (e.g. "a Loan Officer may only approve loans in
  their own branch") — every route's guard is role-only, branch-and-ownership-blind.
- `Permission`/`RolePermission` tables remain unused by application code, same as at the end of
  Milestone 6 — this ADR does not advance AUDIT-3's goal, it only prevents Milestone 8 from
  shipping with zero authorization at all.

These costs are accepted deliberately, scoped to Milestone 8's endpoints only, and tracked as the
reason ADR-038 remains open.

## 4. What must happen before this is replaced

ADR-038 still needs a dedicated design pass — likely its own milestone — to decide: whether
permissions are checked at request time against the database or cached/embedded in the JWT,
whether authorization is role-based, permission-based, or both, and what resource-scoping (branch,
ownership) looks like. Until that happens, every new Milestone 8+ route must use `requireRole`
with an explicit, reviewed allow-list — never `requireAuth` alone (identity-only) for any route
that changes state or exposes borrower/loan data.

## 5. Implementation notes

- `requireRole` lives in `shared/middleware/requireRole.ts`, alongside `requireAuth` — reusable
  by every module, no coupling to `identity`'s infrastructure (reads only `req.authUser.roles`,
  already attached by `requireAuth`).
- `requireRole` must run **after** `requireAuth` in a route's middleware chain (it depends on
  `req.authUser` being populated) — routes that need both compose them explicitly:
  `router.post('/loan-accounts/:id/approve', requireAuth, requireRole('Administrator', 'Manager'), controller.approve)`.
- Rejection is a new `ForbiddenError` (`shared/errors/DomainError.ts`, `httpStatus: 403`),
  distinct from `UnauthorizedError` (401, not authenticated at all) — the existing `errorHandler`
  needs no changes, since both already flow through the same generic `DomainError` → HTTP mapping.
