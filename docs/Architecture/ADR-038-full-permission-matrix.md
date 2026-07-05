# ADR-038 — Full Permission Matrix

**Status:** Accepted (2026-07-06) — §1–§3 all resolved. §4's implementation steps are not yet
done; this ADR describes the target design, not the current code state.
**Context documents:** `PROJECT_RULES.md §User Roles` (2026-07-06 Decision Log entry),
`docs/Architecture/ADR-043-interim-role-based-authorization.md` (the interim mechanism this ADR
eventually replaces), `docs/PROJECT_HANDOFF.md §5` (M-3 field-level PII exposure, §6 current
authorization model).
**Relationship to ADR-043:** ADR-043 explicitly deferred this design to "its own milestone." This
is that milestone's design document. Until §4's implementation checklist is carried out,
`requireRole` and `branchScope` continue operating exactly as ADR-043 describes, using the old
placeholder role names — this ADR is a decided design, not yet a code change.

---

## 1. Role taxonomy (Accepted, 2026-07-06)

The six confirmed roles, per `PROJECT_RULES.md §User Roles`:

| Role | Base access | Loan Applications | Activity Logs | Manage LMS members | Revert a decided application |
|---|---|---|---|---|---|
| **MIS** | Yes | Yes | Yes (only role) | Yes (only role) | Yes (only role) |
| **Loan Operation Manager** | Yes | Yes (assign/approve/decline) | No | No | No |
| **CRM** | Yes | Yes (assign/approve/decline) | No | No | No |
| **Finance** | Yes | No | No | No | No |
| **Accounting** | Yes | No | No | No | No |
| **Collection Officer** | Yes | No | No | No | No |

This table is settled and sourced from the confirmed roster (`PROJECT_RULES.md`'s 2026-07-06
Decision Log entry) — do not re-litigate it here. It replaces the old placeholder list
(Administrator, Manager, Loan Officer, Cashier, Collection Officer, Viewer) that `ADR-043`,
`app/backend/prisma/schema.prisma`'s seed data, and every current `requireRole(...)` call site
still reference.

**This table alone never answered** how these six roles map onto the backend's *existing*
CRUD/approval endpoints (`borrower`, `loan-account`, `loan-product`) — the frontend UI preview that
produced it only ever described access to features that don't exist in the backend yet (Loan
Applications, Activity Logs, Payment Reminders) or partially exist (Member management maps loosely
to `identity`'s `User`, not built out as an admin UI). §3 closes that gap with a separate,
explicit business decision.

## 2. Mechanism (Accepted, carried over from ADR-043's own open question, now decided)

**Decision: keep request-time role checks against the JWT `roles` claim (`requireRole`'s existing
mechanism), not a database-driven `Permission`/`RolePermission` lookup per request.**

Reasoning: the `Permission`/`RolePermission` tables already exist in `schema.prisma` (Milestone 4)
and remain unused by any application code. Wiring them in now would mean every authenticated
request does an extra DB round trip (or requires embedding a permission list in the JWT and
accepting staleness until re-login) to answer a question — "may this role call this endpoint" —
that changes only when a developer adds a new endpoint, not at runtime. `PROJECT_RULES.md`'s
"Permissions must be configurable" and "Avoid hard-coded role checks" principles are honored by
keeping the mapping **centralized in one named constant per router file** (the existing
`ORIGINATION_ROLES`/`APPROVAL_ROLES`/`PRODUCT_CONFIG_ROLES` pattern already used in
`borrowerRouter.ts`/`loanAccountRouter.ts`/`loanProductRouter.ts`, just updated to §3.1's confirmed
names), reviewed and tested like code, rather than by making it database-editable at the cost of a
slower, harder-to-audit request path. This can be revisited if a future
requirement genuinely needs runtime-configurable permissions (e.g. a branch manager assigning
custom permissions without a deploy) — no evidence such a requirement exists today.
`Permission`/`RolePermission` remain unused; do not delete them from the schema (low cost to keep,
avoids a migration if this decision is later reversed).

## 3. Endpoint and field mapping (Accepted, 2026-07-06, business-confirmed)

### 3.1 Backend origination/approval endpoints (`borrower`, `loan-account`, `loan-product`)

| Action | Old allow-list (superseded) | **Confirmed allow-list** |
|---|---|---|
| Create borrower / co-borrower | `Administrator, Manager, Loan Officer` | **MIS, Loan Operation Manager, CRM** |
| Create loan account | `Administrator, Manager, Loan Officer` | **MIS, Loan Operation Manager, CRM** |
| Approve / reject loan account | `Administrator, Manager` | **MIS, Loan Operation Manager, CRM** |
| Configure loan product / version | `Administrator, Manager` | **MIS, Loan Operation Manager, Finance, Accounting** |
| All `GET` (read) endpoints | any authenticated role | **Unchanged — any authenticated role** (confirmed correct, no read restriction needed) |

Confirmed reasoning, so this isn't re-litigated later: origination and approval both use the same
tier (MIS, Loan Operation Manager, CRM) — this mirrors the confirmed Loan-Application
assign/approve/decline access, i.e. the same real-world job function is doing both the
UI-preview's Loan Application review and the backend's actual loan-account origination/approval.
Product configuration is a **wider** tier than origination (adds Finance and Accounting, drops
CRM) — a deliberate business choice: pricing/fee configuration is a Finance/Accounting
responsibility, not a loan-processing one, so CRM (loan processing) is excluded here even though
it's included in origination. Collection Officer has no write access anywhere in §3.1 — confirmed
correctly read-only against every origination/approval/configuration endpoint.

### 3.2 Branch-global access (`GLOBAL_ROLES`, `shared/http/branchScope.ts`)

**Confirmed: `GLOBAL_ROLES = ['MIS']`** — MIS is the only role that sees/writes across every
branch; all five other roles are confined to their own branch. This replaces the old
`GLOBAL_ROLES = ['Administrator']` (a role that no longer exists in the confirmed taxonomy).

### 3.3 Field-level PII exposure (M-3, `docs/PROJECT_HANDOFF.md §5`) — RESOLVED, no redaction needed

**Confirmed: all six roles see full, unredacted PII** (government ID numbers, birthdate, full
contact info) on `GET /borrowers/:id` — every role is internal company staff/officers, and no
role-based masking is required. This **closes M-3 as "confirmed intended behavior," not a gap
needing a code fix** — the current unrestricted-PII response is correct as-is and needs no
presenter change. Do not add field-level redaction logic later without a new, explicit business
decision superseding this one.

### 3.4 Document / Audit modules (not yet built)

`document` and `audit` are empty scaffolds (`docs/PROJECT_HANDOFF.md §2`). This ADR does not need
to solve their permission model yet — only Activity Logs' MIS-only visibility is already confirmed
(§1's table) as a UI-level fact; whether that maps to an `audit` module endpoint restriction is a
question for whenever that module is actually built, not now.

### 3.5 User Management (identity module — not yet built) — RESOLVED, MIS only

**Confirmed, 2026-07-06:** whenever a real User Management endpoint (create/edit/deactivate an
LMS member account, assign a role) is added to the `identity` module, it is gated to **MIS only**.
This decision is made **now, ahead of that endpoint existing**, precisely so the correct
`requireRole('MIS')` allow-list is used from the endpoint's very first version — no separate
decision needed when that work starts.

Context: `identity`'s current HTTP surface (`authRouter.ts`) only has `/login`, `/refresh`,
`/logout`, `/logout-all`, `/me` — no user-CRUD route exists yet. The "Manage LMS members" column
in §1's table describes the frontend UI-preview's mock "Switch Account" panel only; this section
is what makes that same MIS-only rule binding on the real backend endpoint once it's built.

## 4. Implementation checklist (not yet done — tracked here, not started by this ADR itself)

This ADR is a **decision document**, not a code change. Per this project's workflow discipline
(analyze → design → explain → implement → test → document → wait for approval), none of the
following has been implemented yet — it is scoped here for whichever future milestone/checkpoint
takes it on, and requires its own explicit go-ahead before implementation begins:

1. A migration renames the seeded `Role` rows (`app/backend/prisma/seed.ts`'s `roleNames` array)
   from the old six placeholder names to the confirmed six names (§1) — a real schema data change,
   needs its own reviewed migration, not a hand-edit.
2. Every `requireRole(...)` call site (`borrowerRouter.ts`, `loanAccountRouter.ts`,
   `loanProductRouter.ts`) is updated to the confirmed role names per §3.1's table.
3. `GLOBAL_ROLES` in `branchScope.ts` is updated to `['MIS']` per §3.2.
4. No presenter change needed for §3.3 — confirmed as already-correct behavior, not a gap.
5. Regression tests updated: `tests/unit/authorization.test.ts`, `tests/unit/shared/
   branchScope.test.ts`, and every controller/router test that currently asserts against the old
   role names (`Administrator`, `Manager`, `Loan Officer`, etc.).
6. Any existing seeded test fixtures/users referencing the old role names (check
   `tests/unit/**` fixtures and any seed-dependent integration test) need the same rename.
7. **Forward-looking, not actionable yet:** whenever the `identity` module's User Management
   endpoint (create/edit/deactivate an LMS member, assign a role) is actually built, it must be
   gated with `requireRole('MIS')` per §3.5 — decided now so this isn't re-litigated or guessed
   at when that work starts.

## 5. What this ADR deliberately does not do

- Does not introduce resource-ownership authorization (e.g. "a Loan Officer may only act on
  borrowers they personally originated") — no evidence this is a requirement; not invented here.
- Does not change `requireAuth` (identity verification) or the separation between `requireRole`
  (endpoint gate) and `branchScope` (data-scoping gate) — that separation, established by
  ADR-043/H-1, remains correct and is not revisited.
- Does not migrate `Permission`/`RolePermission` data or wire them into any request path (§2).
