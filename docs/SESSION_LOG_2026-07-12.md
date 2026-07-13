# Session Log — 2026-07-12

**Purpose:** Implementation of ADR-050 — Profile Activity Timeline for loan officer activity tracking on Loan Applications, Client Profiles, and Loan Account profiles.

---

## 1. Design & Architecture (ADR-050)

Created comprehensive design document: `docs/Architecture/ADR-050-profile-activity-timeline.md`

**Key decisions:**
- Profile-specific activity log (separate from generic AuditLog)
- Immutable after creation, soft-delete only by MIS
- Tracks: who (officer), what (action), when (timestamp), where (profile ID), details (JSON)
- Actions: attachment_created, attachment_deleted, decision_updated, note_created/updated/deleted, payment_recorded
- API: `GET /loan-applications/:id/activity`, `GET /borrowers/:id/activity`, `GET /loan-accounts/:id/activity`
- MIS-only delete: `DELETE /profile-activity/:id`
- Frontend: Timeline tab on each profile page showing all activities

**Why separate from AuditLog?**
- AuditLog is system-level, global, for compliance
- ProfileActivityLog is user-visible, per-profile, for context-aware accountability
- Different query patterns, retention policies, visibility rules

---

## 2. Database Layer

### Migration
- Created `20260712000000_add_profile_activity_logs/migration.sql`
- New table: `profile_activity_logs` with columns:
  - id (TEXT/uuid), profileType (enum: LOAN_APPLICATION|BORROWER|LOAN_ACCOUNT)
  - profileId (TEXT), userId (TEXT), action (VARCHAR)
  - details (JSONB), visibilityRestricted (BOOLEAN)
  - createdAt, deletedByMisAt (soft-delete timestamp)
- Indexes on (profileType, profileId), userId, createdAt DESC
- Foreign key: userId → users.id (RESTRICT on delete)

### Schema Updates
- Added ProfileType enum (LOAN_APPLICATION, BORROWER, LOAN_ACCOUNT)
- Added ProfileActivityLog model to schema.prisma
- Added relation User.profileActivityLogs

**Status:** Migration SQL ready; Prisma schema generated. Database migration pending (DB not running in this session).

---

## 3. Backend Implementation (Domain Layer)

### Domain Model
- **ProfileActivityLog** domain class (immutable aggregate)
  - Static factory: `create()`, `fromRecord()`
  - Methods: `isDeleted()`, `markDeletedByMis()`
  - Represents a single activity event

---

## 4. Backend Implementation (Application Layer)

### Repository Port
- **IProfileActivityLogRepository** interface
  - `save(activity)` — persist new activity
  - `findMany(options)` — cursor-paginated retrieval per profile
  - `findById(id)` — lookup single activity
  - `softDeleteById(id)` — MIS-only deletion

### Repository Implementation
- **PrismaProfileActivityLogRepository** — Prisma-backed implementation
  - Maps domain objects to/from database
  - Cursor pagination (newest first)
  - Excludes soft-deleted records by default

### Application Service
- **ProfileActivityLogService**
  - `logActivity(input)` — main entry point for other modules to log activities
  - Static helper methods: `actions.attachmentCreated()`, `actions.decisionUpdated()`, etc.
  - Each helper returns `{ action, details }` object

### Use Cases
- **GetProfileActivityUseCase** — retrieve activity timeline for a profile
  - Input: profileType, profileId, limit, cursor, optional action filter
  - Output: paginated activities + next cursor
  - Available to all authenticated users

- **DeleteProfileActivityUseCase** — soft-delete an activity (MIS only)
  - Input: activityId, requestedByUserId
  - Throws if activity not found or already deleted
  - Authorization check upstream

---

## 5. Backend Implementation (HTTP Interface)

### Controller
- **ProfileActivityLogController**
  - `getProfileActivity(req, res)` — GET /:profileType/:profileId/activity
    - Query params: limit, cursor, action
    - Returns: { activities: [...], cursor?: ... }
  - `deleteProfileActivity(req, res)` — DELETE /activity/:activityId
    - MIS only (enforced upstream)
    - Returns: 204 No Content

### Router
- **ProfileActivityLogRouter** — Express router
  - GET /loan-applications/:profileId/activity
  - GET /borrowers/:profileId/activity
  - GET /loan-accounts/:profileId/activity
  - DELETE /profile-activity/:activityId (requireRole(['MIS']))

### Presenter
- **ProfileActivityPresenter** — formats domain objects for HTTP
  - `toHTTP(activity, user)` — returns ProfileActivityHTTPResponse
  - Includes user details (firstName, lastName, email)
  - Includes formatted action label (human-readable)
  - Example: "Uploaded Valid ID" instead of "attachment_created"

---

## 6. Module Export
- Created `index.ts` exporting all public APIs
- Ready for integration into app.ts

---

## Current State

✅ **Completed:**
- ADR-050 design document
- Database migration + Prisma schema
- Domain models (ProfileActivityLog)
- Repository port + Prisma implementation
- Application service (ProfileActivityLogService)
- Use cases (Get, Delete)
- HTTP controller + router
- Presenter for HTTP responses
- Module index + exports

⏳ **Not Yet Done:**
- Wire module into app.ts
- Add ProfileActivityLogService injections into other modules (loan-application, document, payment)
- Hooks to call logActivity() after actions (approve/decline, attach file, record payment)
- Frontend: ProfileActivityTimeline component + tab integration
- Tests for all layers
- Database deployment (pending DB availability)

---

## How to Continue (Next Session)

### Phase 1: Wire into App
1. In `app/backend/src/server.ts` (or app.ts):
   - Instantiate PrismaProfileActivityLogRepository
   - Instantiate ProfileActivityLogService
   - Instantiate use cases
   - Instantiate controller
   - Register router

2. Ensure middleware is applied: authenticateToken before routes, requireRole(['MIS']) on delete

### Phase 2: Add Activity Logging Hooks
Each of these modules should call `profileActivityLogService.logActivity()` after success:

1. **Loan Application Module**
   - `ApproveLoanApplicationUseCase` — log "decision_updated" (PENDING → APPROVED)
   - `DeclineLoanApplicationUseCase` — log "decision_updated" (PENDING → DECLINED)
   - `RevertLoanApplicationUseCase` — log "decision_updated" (APPROVED/DECLINED → PENDING)

2. **Document Module**
   - After `POST /attachments` — log "attachment_created"
   - After `DELETE /attachments/:id` — log "attachment_deleted"

3. **Payment Module**
   - After `POST /loan-accounts/:id/payments` (ProcessPaymentUseCase) — log "payment_recorded"
   - Include payment amount, principal/interest/fees breakdown, officer ID

### Phase 3: Frontend Integration
1. Add ProfileActivityTimeline component (`src/components/ProfileActivityTimeline.tsx`)
   - Fetches from `GET /loan-applications/:id/activity`
   - Displays timeline with officer name, action label, timestamp, details
   - Cursor pagination for large histories

2. Add "Activity" tab to:
   - LoanApplicationDetailPage
   - ClientProfilePage (BorrowerProfileDetail)
   - LoanDetailPage (RealLoanDetailView)

3. Implement `useProfileActivity` hook (TanStack Query)
   - Fetches activities on mount
   - Supports pagination
   - Optional action filter

### Phase 4: Testing
- Unit tests for domain/application layers
- Integration tests for repository
- Controller tests (mock repository)
- Router tests with supertest
- Frontend component tests

---

## Technical Notes

### Why ProfileActivityLog is Separate from AuditLog
- **AuditLog:** System-level, security-focused, WHO accessed WHAT WHEN (audit trail)
- **ProfileActivityLog:** Business-focused, WHO did WHAT to this profile and WHY (context)
- Different audiences: AuditLog for compliance/security, ProfileActivityLog for business users

### Soft Delete Pattern
- Records are never hard-deleted; `deletedByMisAt` timestamp marks soft deletion
- Queries exclude soft-deleted records by default
- `findById()` returns null if record is deleted
- Deletion timestamp itself is evidence of who deleted what when

### Action Details Structure (JSONB)
Each action type has a defined details structure (see ADR-050):
- `attachment_created`: { attachmentId, documentCategory, fileName }
- `decision_updated`: { fromStatus, toStatus, reason, ... }
- `payment_recorded`: { paymentId, amount, principal, interest, fees, repaymentInstallmentId, allocationDetails }
- `note_created`: { noteId, content }

This ensures queries/reporting can traverse the details safely.

### User Details in Response
The controller returns `user: { id, firstName, lastName, email }` by joining with the users table.
The presenter handles formatting; controller does the join.

---

## References

- ADR-050: docs/Architecture/ADR-050-profile-activity-timeline.md
- User request: This session (2026-07-12)
- Related: ADR-038 (RBAC), ADR-047 (Financial Audit Isolation)

---

# Addendum — Application → Client Linking + Mock Data Removal Initiative (2026-07-12, later same day)

**Trigger:** User request — on the Loan Applicant Profile, "Create Client Profile" should stop
being clickable once the applicant is already a client, and a "Create Loan Account Profile"
button/link should appear once a client exists.

## 1. Discovery: two different data layers in play

Initial investigation found `LoanApplication.clientCreated` / `createdClientId` /
`loanAccountCreated` / `createdLoanAccountId` fields in `app/frontend/src/lib/mockData.ts` — but
these are **not used** by the real page. `LoanApplicationDetailPage.tsx` uses the real API types
(`loanApplicationApiTypes.ts`) and `apiClient`, which have no such fields.

Confirmed via backend audit: **no link existed anywhere** (Prisma schema, use cases, or API)
between `LoanApplication` → `Borrower` → `LoanAccount`. This required a real migration, not a UI
toggle.

**User decision:** Option A — implement the real backend link, and treat this as the start of a
deliberate, incremental mock-data removal effort (replacing SDevTech, per CLAUDE.md's project
objective). This addendum + the follow-up task list is the tracking record for that initiative.

## 2. Backend changes (real data, shipped this session)

- **Migration** `20260712050000_add_borrower_source_application`: adds `borrowers.sourceApplicationId`
  (nullable, unique, FK → `loan_applications.id`, `ON DELETE SET NULL`). One application produces
  at most one borrower.
- **Prisma schema**: `Borrower.sourceApplicationId` / `sourceApplication` relation;
  `LoanApplication.createdBorrower` reverse relation.
- **Domain**: `Borrower` domain class gets `sourceApplicationId` on `BorrowerProps`/
  `CreateBorrowerProps` + getter.
- **Repository**: `IBorrowerRepository` gains `findBySourceApplicationId` and
  `findManyBySourceApplicationIds` (batched, for list views); implemented in
  `PrismaBorrowerRepository`.
- **API**: `POST /borrowers` accepts optional `sourceApplicationId` (`createBorrowerSchema`),
  passed through `CreateBorrowerUseCase` → `Borrower.create()` → persisted. `BorrowerPresenter`
  now returns it.
- **`GET /loan-applications/:id` and `GET /loan-applications`**: `LoanApplicationController` now
  looks up the linked borrower (and, if present, that borrower's first loan account) and the
  presenter returns `createdBorrowerId`, `createdLoanAccountId`, `createdLoanAccountCode`. List
  view batches this in one query instead of N+1 (`presentMany`). Wired via existing
  `borrowerRepository`/`loanAccountRepository` instances already constructed in `app.ts`.

## 3. Frontend changes (shipped this session)

- `loanApiTypes.ts`: `Borrower.sourceApplicationId`, `CreateBorrowerRequest.sourceApplicationId`.
- `loanApplicationApiTypes.ts`: `LoanApplication.createdBorrowerId` /
  `createdLoanAccountId` / `createdLoanAccountCode`.
- `LoanApplicationDetailPage.tsx`:
  - `CreateClientProfileDialog`'s `POST /borrowers` call now sends `sourceApplicationId: application.id`,
    and invalidates the `['loan-application', id]` query on success so the button updates without
    a manual refresh.
  - Header button: if `application.createdBorrowerId` is set, renders a **"Client Profile
    Created"** button that links to `/clients/:id` instead of the create button; otherwise shows
    the original (approved-only) "Create Client Profile" button.

## 4. Deferred: "Create Loan Account" button on the application page

Investigated wiring a "Create Loan Account Profile" button next to the above. Found that
**`ClientProfilePage.tsx` (`/clients/:id`) is still 100% mock-data-driven** — `MockBorrowerProfile`,
`clientHasActiveLoan`, `findApprovedApplicationForClient`, `createLoanAccountForClient`,
`MOCK_LOAN_PRODUCTS`, all from `mockData.ts`. It doesn't fetch the real borrower by ID at all.

**Consequence already in production as of this session:** since `CreateClientProfileDialog`
now navigates to `/clients/<real-uuid>` after creating a real client, that page will currently
show "Sample client not found" for any client created through the real flow — `ClientProfilePage`
looks the ID up in the mock array, not via the real API.

**Decision (user, Option A):** do not build a new "Create Loan Account" button against the mock
dialog/mock data as an interim patch. Fix the root cause instead — migrate `ClientProfilePage.tsx`
to real data first. Tracked as its own task (see below) rather than folded into this change, to
avoid shipping more mock-dependent code.

## Current State

✅ Real `LoanApplication` ↔ `Borrower` link now exists end-to-end (schema → API → UI) and the
"Create Client Profile" button correctly disables/relabels once a client exists.
⏳ `ClientProfilePage.tsx` is still mock-only — **known broken for any client created via the now-real
"Create Client Profile" flow** (won't be found on that page). This is the top-priority next fix.
⏳ "Create Loan Account" button on the Loan Application Detail page is deferred until
`ClientProfilePage.tsx` is real-data-backed.
⏳ `CreateLoanAccountDialog.tsx` itself (`MOCK_LOAN_PRODUCTS`, `MockLoanAccount`) also needs
migration to real loan-product/loan-account APIs as part of the same effort — the backend already
has real `LoanAccount`/`LoanProductVersion` schema and (per earlier sessions) some real loan
account read APIs; loan account *creation* from the UI has not been verified as real yet.

## Mock Data Removal Initiative — Tracking

This is an explicit, ongoing initiative per user instruction (2026-07-12): progressively replace
all remaining `mockData.ts`-backed pages/components with real backend-wired equivalents, as part
of making Easycash LMS production-ready to replace SDevTech. Known remaining mock-backed surfaces
identified so far (not exhaustive — surfaced opportunistically as pages are touched):

- `ClientProfilePage.tsx` — full page, borrower profile + loan history + loan creation trigger.
- `CreateLoanAccountDialog.tsx` — loan product selection, origination math, loan creation.
- Any other page still importing from `@/lib/mockData` (not audited exhaustively this session —
  recommend a `grep -rl "from '@/lib/mockData'" app/frontend/src/pages` pass at the start of the
  next session to get a complete surface list before picking the next target).

**Working rule going forward:** each migration should be its own reviewed, incremental change
(per CLAUDE.md's "work incrementally... wait for approval" workflow) — not a single mass rewrite.

---

# Addendum 2 — ClientProfilePage.tsx real "Create Loan Account" (2026-07-12, later same day)

**Trigger:** User confirmed Option A again ("continue removing mock data") after the deferral
above.

## Correction to Addendum 1

On actually opening `ClientProfilePage.tsx` to migrate it, the "known broken — Sample client not
found" claim in Addendum 1 turned out to be **wrong** — flagging that explicitly rather than
quietly editing the earlier entry, per CLAUDE.md's "distinguish confirmed/assumed" rule.

The page was already dual-mode as of `RealEditClientDialog`'s wiring: `getMockBorrower(id)` only
matches a small set of hand-authored sample IDs, so a real UUID from `ClientListPage` or the new
"Create Client Profile" flow correctly falls through to **`RealClientProfileView`**, which was
already fetching `GET /borrowers/:id` and real loan accounts, with a real `PATCH` edit dialog. The
page's own banner already said as much: "Create Loan Account and Attachments are not yet wired to
real data for this screen" — i.e. only those two pieces, not the whole page, were mock. Should
have opened the file before writing that claim in Addendum 1.

## What was actually missing, and what shipped this session

`RealClientProfileView` had no "Create Loan Account" button at all. Backend audit confirmed a real,
working `POST /loan-accounts` endpoint already exists (`createLoanAccountSchema` — `loanCode`,
`borrowerId`, `loanProductVersionId`, `branchId`, `principalAmount`, `interestRate`,
`installmentCount`, `firstRepaymentDate`, optional `gracePeriodDays`/`addOnInterestRate`/
`contractualInterestRate`/`loanOfficerId`), restricted to `MIS`/`Loan Operation Manager`/`CRM`
(ADR-038 §3.1) — this had simply never been called from the frontend before.

Added to `ClientProfilePage.tsx`:

- **`RealCreateLoanAccountDialog`** — new dialog, `POST /loan-accounts` against the real API.
  Deliberately narrower than the mock `CreateLoanAccountDialog` (no fee waivers, disbursement
  bank, payment method) — those aren't in `createLoanAccountSchema` yet, so the dialog only offers
  fields the real API can actually persist. **`loanCode` is a required, staff-typed field**, not
  auto-generated — no confirmed production loan-code numbering rule exists yet (the mock's
  `BL-REG_NNNNN` pattern was never confirmed as *the* rule), and CLAUDE.md forbids fabricating
  financial/business logic. Same reasoning as ADR-045's explicit, never-derived
  `firstRepaymentDate`.
- **`RealClientProfileView`** eligibility logic, mirroring the mock page's own rule 1:1 but on
  real data: `hasActiveLoan` = any of this borrower's real loan accounts in a non-closed status;
  `eligibleApplication` = a real `LoanApplication` where `createdBorrowerId` matches this borrower,
  `status === 'APPROVED'`, and `createdLoanAccountId` is still null (fetched via
  `GET /loan-applications`, using the linkage fields added earlier this session). Button
  shows/disables/hides using the same `canCreateLoanAccount` role gate and warning-banner pattern
  the mock page already used, so the UX is unchanged for staff.
  - Fetches products via a new distinct query key (`['loan-products', 'all', 'clientProfilePage']`)
    rather than reusing the page's old `['loan-products', 'all', 'versionToProductNameMap']` key,
    since the dialog needs full `LoanProductVersion` objects (for `defaultInterestRate` etc.), not
    just the name-lookup `Map` the table used. Both are now derived from one fetch via `useMemo`.
- Updated the page's own real-data banner to say Create Loan Account is live; only Attachments
  remains mock on this page.

Typechecked clean (frontend `tsc --noEmit`). **Not verified live in a browser** — this machine is
frontend-only per [infrastructure_hosting_plan] memory (DB/backend runs on Nomer's laptop), so a
full login → approve application → create client → create loan account walkthrough needs to happen
there or in a session with DB access.

## Current State (supersedes Addendum 1's "Current State")

✅ `LoanApplication` ↔ `Borrower` real link (Addendum 1).
✅ `ClientProfilePage.tsx`'s real path (`RealClientProfileView`) now has a real, working "Create
Loan Account" button end-to-end (schema → API → dialog → navigate to the new loan).
⏳ Still mock on this page: **Attachments** section only.
⏳ **`CreateLoanAccountDialog.tsx`** (the older, richer mock dialog used by nothing now except its
own component file) still exists with `MOCK_LOAN_PRODUCTS`/`MockLoanAccount` — not deleted this
session since nothing currently imports it for the real flow; worth removing once confirmed unused
elsewhere, or evolving `createLoanAccountSchema` to accept fee waivers/disbursement bank so the
real dialog can absorb that functionality instead of leaving two dialogs.
⏳ Next targets for the mock-removal initiative: run
`grep -rl "from '@/lib/mockData'" app/frontend/src/pages` at the start of the next session for a
current, complete list before picking the next page.

---

# Addendum 3 — LoanDetailPage.tsx real Approve/Activate (2026-07-12, later same day)

**Trigger:** User: "continue finding and replacing mock data with real backend/frontend data."
Picked this as the next target because it directly closes the loop opened by Addendum 2's real
"Create Loan Account" — a loan created there starts in `PENDING_APPROVAL` and, before this change,
had **no real way to move forward** (approve/activate only existed on the mock page's code path).

## Survey

`grep -rl "from '@/lib/mockData'" app/frontend/src/pages` → 9 files;
`app/frontend/src/components` → 4 files. Most page hits turned out to be incidental (a single
constant or type import - `COMPANY_INFO`, `INTAKE_DOCUMENT_OPTIONS`, `ACTIVE_PAYMENT_METHODS`,
`logActivity`, `LmsRole`, etc.), not full mock-data-driven views. `LoanDetailPage.tsx` was the
one other file (besides `ClientProfilePage.tsx`, already handled) with a real/mock split of
meaningful size - it already had a `RealLoanDetailView` (balances, borrower, repayment schedule,
risk assessment, payment history, wired since the original Frontend↔Backend Wiring Pilot) whose
own doc comment listed "approve/activate actions" as still mock-only.

## What shipped

Backend already had real, working `POST /loan-accounts/:id/approve` and `/activate` endpoints
(role-gated to `MIS`/`Loan Operation Manager`/`CRM` per ADR-038 §3.1/§3.6, same tier as
origination) - simply never called from `RealLoanDetailView`. Added:

- `approveMutation` / `activateMutation` (React Query `useMutation`) calling those endpoints.
  `activate` sends an `Idempotency-Key` header via a `crypto.randomUUID()` ref, reset only on
  success - same pattern already established in `PaymentRecordingPage.tsx` for its payment POST
  (idempotency-protected the same way server-side).
- Header buttons "Approve Loan" / "Activate Loan", shown only for the matching `loan.status`
  (`PENDING_APPROVAL` / `APPROVED`) and gated on `canCreateLoanAccount` (the existing role flag
  already matching ADR-038's origination/approval/activation tier - no new role flag needed).
- Confirm dialog reusing the mock page's exact copy/UX (safety-net "Yes, confirm" step), with a
  real inline error message on failure (`ApiError` message, or a generic connectivity message)
  instead of the mock path's always-succeeds behavior.
- On success, invalidates `['loan-account', loanId]`, `['loan-accounts', 'all']`, and (activate
  only) `['repayment-schedule', loanId]` so the page and its schedule tab reflect the new state
  immediately.

Typechecked clean. **Not verified live** - same DB/backend access constraint as Addendum 2 (this
machine is frontend-only).

## Current State (supersedes Addendum 2's "Current State")

✅ Real loan lifecycle now reachable end-to-end from the UI: Create Client Profile → Create Loan
Account → Approve → Activate, all against real APIs.
⏳ Still mock on `RealLoanDetailView`: notes, attachments, reminders tabs.
⏳ Still mock on `RealClientProfileView` (Addendum 2): Attachments.
⏳ Broader survey result (this addendum) for next session: of the 9 pages + 4 components still
importing `@/lib/mockData`, only `LoanApplicationCreatePage.tsx` (uses `INTAKE_DOCUMENT_OPTIONS` -
worth a quick look, unclear yet if it's a real form with one leftover mock constant or something
bigger) hasn't been individually triaged yet. The rest (`DashboardPage`, `LoginPage`,
`MemberListPage`, `PaymentRecordingPage`, `SettingsPage`, `StatementOfAccountPage`, and the 4
components) appeared to be single-constant/type imports on a skim, not full mock views - each
still needs its own confirm-before-migrating pass, not just a grep-based assumption.

---

# Addendum 4 — Dashboard Collections Forecast, real (2026-07-12, later same day)

**Trigger:** User: continue the mock-removal effort. Closer look at the remaining 9 pages found
`StatementOfAccountPage.tsx` already fully real (same dual-mode pattern as the others, just not
previously noticed) and `LoanApplicationCreatePage.tsx`'s only mock import
(`INTAKE_DOCUMENT_OPTIONS`) is a static UI checklist, not fake business data - not a migration
target. `DashboardPage.tsx` had two real gaps: **Collections Forecast** (fake chart, but its own
description already stated a real, buildable methodology) and **Collections vs. Target** (the
`target` line is a business-set number with no real source yet - a genuine business-decision
prerequisite, not a wiring gap). Per user's Option A, implemented the former; left the latter
as disclosed sample data pending that decision (asked, not assumed).

## What shipped

**Backend** (`IDashboardRepository` / `PrismaDashboardRepository`): added `collectionsForecast` to
`GET /dashboard/summary`'s response - for each of the next 4 calendar months, the sum of
`RepaymentSchedule.principalDue + interestDue` across every `ACTIVE`/`ACTIVE_IN_ARREARS` loan
account, branch-scoped like every other field on this endpoint. One `Promise.all`-batched query per
month (4 total), using the existing `dueDate` index - no new N+1 risk, consistent with this
repository's existing on-demand-aggregate approach (documented in its own header comment as
acceptable at today's volume, revisit with a materialized rollup at 100,000+ loans per CLAUDE.md's
performance goals).

Deliberately **dropped the "collection-realization rate" adjustment** the mock version applied
(`average actual ÷ target` from `COLLECTIONS_VS_TARGET`) - that rate is only meaningful once a real
monthly target exists, which it doesn't yet (see Addendum 3's option-B punt, still open). Reported
figures are scheduled amounts due, not a probability-weighted prediction - the card's copy was
updated to say exactly that, so it can't be mistaken for one.

**Frontend**: `DashboardPage.tsx`'s Collections Forecast chart now reads
`summaryQuery.data.collectionsForecast` instead of `SAMPLE_COLLECTIONS_PROJECTION`; removed the
"Sample Projection" badge (no longer sample data) and updated the card's explanatory copy.
`COLLECTIONS_VS_TARGET` mock import stays, scoped to the Target card only.

Typechecked clean (backend + frontend). **Not verified live** - same DB/backend access constraint
noted in Addendums 2/3.

## Current State (supersedes Addendum 3's "Current State")

✅ Full real loan lifecycle (Addendum 3) + real Collections Forecast on the Dashboard.
⏳ Dashboard's "Collections vs. Target" card still uses mock `COLLECTIONS_VS_TARGET` - blocked on
a business decision (how/who sets a real monthly collection target), not a technical gap. Flagged
to user 2026-07-12, deferred at their instruction (Option A: proceed with what's buildable now).
⏳ Still mock: `RealLoanDetailView` notes/attachments/reminders, `RealClientProfileView`
attachments (both from Addendums 2-3).
⏳ Next targets: the remaining incidental mock imports (`DashboardPage` has no more after this;
`LoginPage`, `MemberListPage`, `PaymentRecordingPage`, `SettingsPage` each have one small
constant/type import - worth a quick individual check each, but none looked like a full mock view
on the earlier skim) and the 4 components (`CreateLoanAccountDialog.tsx`,
`LoanDrillDownDialog.tsx`, `PaymentMethodBadge.tsx`, `StatusBadge.tsx`).

## Addendum 4 follow-up — remaining `@/lib/mockData` imports individually checked, session close

Checked every remaining hit from the earlier survey individually (not just by grep, per the
"confirm before migrating" rule stated above):

- `LoginPage.tsx` (`COMPANY_INFO`), `PaymentRecordingPage.tsx` (`ACTIVE_PAYMENT_METHODS`),
  `LoanDrillDownDialog.tsx`/`StatusBadge.tsx` (`LoanAccountStatus`/`RepaymentInstallmentStatus`
  types), `MemberListPage.tsx` (`LmsRole` type) - all static UI config or type-only imports, not
  fake business records standing in for real data. Not migration targets.
- `PaymentMethodBadge.tsx` (`getPaymentMethodLabel`, `isDiscontinuedPaymentMethod`) - label-lookup
  helper functions over a static enum, same category.
- `SettingsPage.tsx` (`logActivity`) - **dead code**, not a rendering-mock-data problem: it pushes
  onto an in-memory `MOCK_ACTIVITY_LOGS` array that nothing displays anymore.
  `RecentActivityPanel.tsx` (used on 16 pages including this one) already reads exclusively from
  the real `/audit-logs` API (`AuditLog` type, `apiClient.get`) - confirmed by reading the
  component, it has no mock fallback at all. The scattered `logActivity(...)` calls across the
  codebase are therefore inert leftovers from before that panel was wired to the real audit trail.
  Worth a follow-up cleanup pass (delete the calls + the mock log array/functions), but that's
  dead-code removal, not a "replace fake data" fix - lower priority, flagging rather than doing
  it unprompted this session.
- `CreateLoanAccountDialog.tsx` - still mock (`MOCK_LOAN_PRODUCTS`/`MockLoanAccount`), per
  Addendum 2's note; nothing in the real flow imports it anymore after `RealCreateLoanAccountDialog`
  shipped, but it's not deleted (still used by the old mock `ClientProfilePage()` code path for
  hand-authored sample clients, which itself is intentionally out of scope - sample-client demo
  data, not real-client-masquerading-as-mock).

**Conclusion: no further full-page/full-flow mock-to-real migration targets remain from this
survey.** The substantive gaps found and fixed this session (Application↔Client↔LoanAccount
linkage, Create Loan Account, Approve/Activate, Collections Forecast) are done. What's left falls
into three buckets, none of which are "users are shown fake data as if real":
1. Deliberately-deferred, disclosed sample data pending a business decision (Collections vs.
   Target - Addendum 3/4).
2. Not-yet-built real features on otherwise-real pages (notes/attachments/reminders on Loan
   Account and Client Profile detail pages).
3. Dead code / unused legacy components that no longer affect what users see (`logActivity`,
   `CreateLoanAccountDialog.tsx`).

Committed and pushed to `origin/main` this session as `26630e0`.

---

# Addendum 5 — real Attachments on Client Profile and Loan Account (2026-07-12, later same day)

**Trigger:** User: continue the mock-removal effort, after Addendum 4's follow-up concluded no
further full-page targets remained. Re-examined the "still mock" list from Addendums 2/3
(Attachments on both pages) with fresh eyes rather than stopping.

## Discovery

`AttachmentsPanel.tsx` (already real, used by `LoanApplicationDetailPage.tsx` since an earlier
session) is built generically against `AttachmentOwnerType = 'BORROWER' | 'LOAN_ACCOUNT' |
'LOAN_APPLICATION'` - its own doc comment says as much: "built generically... so Borrower/
LoanAccount detail pages can adopt it later without change." Backend (`IAttachmentRepository`,
`ListAttachmentsForOwnerUseCase`, `PrismaAttachmentRepository`) already supports all three owner
types too. Nobody had actually dropped the component onto those two pages yet - a pure wiring
gap, zero new backend work needed.

## What shipped

- `RealClientProfileView` (`ClientProfilePage.tsx`): added `<AttachmentsPanel ownerType="BORROWER"
  ownerId={borrower.id} canUpload />`. `canUpload` is unconditional (`true`), matching this page's
  existing precedent - "Edit / Customize Details" has no role gate either, so there was no
  established permission flag to reuse here (unlike Create Loan Account's `canCreateLoanAccount`).
  Updated the page's real-data banner to drop the "Attachments not yet wired" caveat.
- `RealLoanDetailView` (`LoanDetailPage.tsx`): added `<AttachmentsPanel ownerType="LOAN_ACCOUNT"
  ownerId={loan.id} canUpload />`. This file already had its own **mock** `AttachmentsPanel`
  function (used by the old mock loan page) - the real import was aliased to
  `RealAttachmentsPanel` to avoid the name collision rather than renaming the mock one (smaller
  diff; the mock component is still legitimately in use by the mock code path). Updated the
  `RealLoanDetailView` doc comment.

Typechecked clean. **Not verified live** - same DB/backend constraint as prior addendums.

## Current State (supersedes Addendum 4's)

✅ Both `RealClientProfileView` and `RealLoanDetailView` are now fully real except for
Notes/Reminders (loan account) - no more "not yet wired" attachments caveat on either page.
⏳ Still mock: Notes and Reminders tabs on `RealLoanDetailView` (in-browser-only, clearly
labeled as such - no backend note/reminder storage exists yet, would need its own schema+API
before it could go real, same shape of gap as the Collections-Target business decision, not a
pure wiring fix).
⏳ Collections vs. Target (Addendum 3/4) - still blocked on a business decision.
⏳ `logActivity`/`MOCK_ACTIVITY_LOGS` dead code (Addendum 4 follow-up) - unchanged, still flagged
for an optional future cleanup pass, not done this session.

---

# Addendum 6 — real Notes (new backend module) (2026-07-12, later same day)

**Trigger:** User: continue the mock-removal effort. Addendum 5's "Current State" left Notes as
the one remaining `RealLoanDetailView` gap that wasn't blocked by a business decision (unlike
Collections vs. Target) - just needed its own schema+API, which didn't exist yet anywhere in the
backend (confirmed: no `Note`/`Reminder` model in `schema.prisma` before this).

## What shipped

**New `note` backend module**, mirroring the `document` module's flat structure exactly (no rich
domain class - same simplicity level as `Attachment`, per that module's own precedent):

- Prisma: `Note` model + `NoteOwnerType` enum (`BORROWER` | `LOAN_ACCOUNT` | `LOAN_APPLICATION` -
  same three values as `AttachmentOwnerType`, kept as a separate enum rather than shared, since
  Note and Attachment are independent tables). Polymorphic `ownerType`/`ownerId` shape, indexed,
  `authorUserId` FK to `users`. Migration `20260712060000_add_notes`. Immutable - no edit/delete
  use case, an append-only log by design ("a running log, not a wiki" - matches how the mock
  `NotesPanel` behaved).
- `INoteRepository` / `PrismaNoteRepository`, `CreateNoteUseCase` (trims + rejects blank text),
  `ListNotesForOwnerUseCase`, `NoteController`/`noteRouter`/`noteSchemas`/`NotePresenter` - all
  new files under `app/backend/src/modules/note/`, following the identical layering as
  `app/backend/src/modules/document/`. Wired into `app.ts` right after the document module.
- **Deliberately no role restriction on `POST /notes`** (unlike Attachments'
  `ATTACHMENT_WRITE_ROLES`) - any authenticated staff member could add a note in the mock version,
  and a note is a low-stakes running log, not a financial or decision action.

**Frontend**: new `noteApiTypes.ts` (mirrors the presenter JSON) and a new reusable
`NotesPanel.tsx` component (`@/components/NotesPanel.tsx`), built generically against
`NoteOwnerType` the same way `AttachmentsPanel` was - explicitly written so it can be dropped onto
Borrower/LoanApplication pages later without changes, same reasoning that made Addendum 5's
Attachments wiring a pure drop-in. Wired into `RealLoanDetailView` (aliased to `RealNotesPanel` -
`LoanDetailPage.tsx` already has its own same-named mock `NotesPanel` function for the old mock
page, same collision/alias pattern as Addendum 5's `RealAttachmentsPanel`).

Typechecked clean (backend + frontend, Prisma client regenerated). **Not verified live** - same
DB/backend constraint as every prior addendum this session; this one in particular needs a real
DB migration run (`prisma migrate deploy`) before `/notes` will work anywhere.

## Current State (supersedes Addendum 5's)

✅ `RealLoanDetailView` is now real for everything except Reminders.
✅ Notes is generically reusable - `ClientProfilePage.tsx`/`LoanApplicationDetailPage.tsx` could
adopt `<NotesPanel ownerType="BORROWER" .../>` or `ownerType="LOAN_APPLICATION"` with zero backend
work, if wanted later.
⏳ Reminders tab on `RealLoanDetailView` - same shape of gap Notes just closed (needs its own
schema+API), not done this session.
⏳ Collections vs. Target - still blocked on a business decision (Addendum 3/4).
⏳ `logActivity`/`MOCK_ACTIVITY_LOGS` dead code - still an optional future cleanup, unchanged.
⏳ **New follow-up for next session:** run the new `20260712060000_add_notes` migration against
the real database (this machine can't - frontend-only per [infrastructure_hosting_plan] memory).

---

# Addendum 7 — real Reminders panel, closing RealLoanDetailView (2026-07-12, later same day)

**Trigger:** User: continue the mock-removal effort. Before touching Reminders (the one remaining
`RealLoanDetailView` gap), asked the user two clarifying questions per CLAUDE.md's "never guess,
never invent business rules":

1. Does the company have an SMS/Email provider to wire up? **Answer: not yet - pending from MIS
   Nomer.**
2. Is the mock's 5/3/1-days-before + due-date + weekly-past-due trigger schedule confirmed real
   business policy? **Answer: confirmed, yes.**

This meant: build the real trigger-schedule computation now (confirmed policy, no external
dependency), but the actual SMS/Email *sending* stays explicitly "Coming Soon" (no provider to
call yet) rather than being faked.

## What shipped (frontend only - no backend changes needed)

Realized mid-investigation that a **separate, already-real** `PaymentRemindersPage.tsx`
(`GET /payment-reminders`) already exists as a portfolio-wide worklist, explicitly disclosed as
"no SMS/email notification service is wired up yet." What was still missing was a **per-loan**
Reminders view on `RealLoanDetailView` itself (the old mock `LoanDetailPage()`'s Reminders tab
was still `MOCK_PAYMENT_REMINDERS`-driven).

Added to `LoanDetailPage.tsx`:

- `computeReminderTriggers(dueDate, isLate)` - pure function reproducing the confirmed schedule
  exactly (5/3/1 days before, due date, up to 3 weekly past-due occurrences), ported 1:1 from the
  retired mock's `buildRemindersForLoan()` trigger-generation logic (only the *schedule* was
  carried over, not that function's fake "Sent" simulation).
- `buildRealReminderMessage(...)` - same SMS/Email message template as the mock version, now
  filled from real borrower/loan/installment data instead of mock records.
- **`RealRemindersPanel`** - computes the next unpaid installment straight from the repayment
  schedule `RealLoanDetailView` already has loaded (`installmentsQuery.data.items` - no new
  network call), shows each trigger's date and whether it's `Due` or `Upcoming`. Deliberately
  **does not label anything "Sent"** - unlike the mock version's `SENT`/`SCHEDULED` status, since
  no notification actually goes out yet, that would be a fabricated event. SMS/Email rows show a
  "Coming Soon" badge with the borrower's real phone/email as the would-be recipient, honest about
  what's missing (provider integration, pending Nomer) rather than simulating a send.

Typechecked clean (name collision with the mock file's own `buildReminderMessage`/local
`RemindersPanel` resolved by naming the new function/component distinctly, same pattern as
`RealAttachmentsPanel`/`RealNotesPanel` aliasing in Addendums 5-6).

**Not verified live** - same DB/backend constraint as every prior addendum.

## Current State (supersedes Addendum 6's)

✅ **`RealLoanDetailView` is now fully real on every tab/section** - balances, borrower,
repayment schedule, risk assessment, payment history, Approve/Activate, Attachments, Notes, and
Reminders (trigger schedule; sending is honestly "Coming Soon").
✅ `RealClientProfileView` real on everything except Attachments... wait, Attachments shipped in
Addendum 5 - `RealClientProfileView` is fully real now too, no known remaining gaps.
⏳ Collections vs. Target (Dashboard) - still blocked on a business decision (Addendum 3/4).
⏳ SMS/Email sending itself - blocked on a provider, pending MIS Nomer. Once available: wire
`RealRemindersPanel`'s "Coming Soon" rows to a real send action, and decide whether to persist a
send-history record (would need its own schema, similar shape to Notes).
⏳ `logActivity`/`MOCK_ACTIVITY_LOGS` dead code - still an optional future cleanup, unchanged.
⏳ Migration `20260712060000_add_notes` still needs to run against the real database (Addendum 6).

**With this addendum, the two main detail pages (Client Profile, Loan Account) touched by this
session's mock-removal effort are fully real.** Remaining known gaps are either business-decision-
blocked (Collections Target) or infrastructure-blocked (SMS/Email provider), not further wiring
work - a good natural stopping point for this thread unless the user opens a new area.

---

# Addendum 8 — changelog cleanup + dead-code removal (2026-07-12, later same day)

**Trigger:** User: (1) fix the About page - consolidate the two "July 7, 2026" changelog entries
into one, and re-sequence the version numbers; (2) continue the mock-removal effort; (3) save and
sync.

## 1. About page / changelog cleanup

`lmsVersion.ts`'s `LMS_CHANGELOG` had two separate entries both dated "July 7, 2026" (`0.9.1` and
`0.9.2`). Merged them into a single `0.9.1` entry (all highlights combined, `0.9.1`'s items first
since it was chronologically first-numbered), then renumbered every subsequent entry down by one
patch version to keep the sequence contiguous:

| Before | After | Date |
|---|---|---|
| 0.9.8 | 0.9.7 | Jul 12 (today's session) |
| 0.9.7 | 0.9.6 | Jul 12 (earlier that day - Activity Timeline, Roles admin) |
| 0.9.6 | 0.9.5 | Jul 11 |
| 0.9.5 | 0.9.4 | Jul 10 |
| 0.9.4 | 0.9.3 | Jul 9 |
| 0.9.3 | 0.9.2 | Jul 8 |
| 0.9.2 + 0.9.1 | 0.9.1 (merged) | Jul 7 |
| 0.9.0 | 0.9.0 | Jul 6 (unchanged) |
| 0.8.0 | 0.8.0 | Jul 5 (unchanged) |

`LMS_VERSION`/`LMS_UPDATED_ON`/the About page's "Current" badge all derive from
`LMS_CHANGELOG[0]` automatically (per that file's own doc comment) - no other file needed
updating. The two genuine July 12 entries were deliberately left as two separate entries (per the
user's instruction, scoped only to July 7) - they really are two distinct work sessions that day.

## 2. Dead-code cleanup: `logActivity`/`MOCK_ACTIVITY_LOGS`

Flagged in Addendum 4 as an optional future cleanup, done now. Confirmed (again) that
`RecentActivityPanel.tsx` (used on 16+ pages) reads exclusively from the real `/audit-logs` API -
nothing anywhere reads `MOCK_ACTIVITY_LOGS`. Removed:

- `MockActivityLogEntry` interface, `buildActivityLog()`, `MOCK_ACTIVITY_LOGS`, and the
  `logActivity()` writer function from `mockData.ts`.
- Every call site: `ClientProfilePage.tsx` (mock `saveEdit`), `LoanDetailPage.tsx` (mock
  `NotesPanel`/`AttachmentsPanel` - both lost their now-unused `loanCode` prop too, since it only
  existed to feed `logActivity`), `SettingsPage.tsx` (`LanguageTab`/`AppearanceTab` lost their
  now-unused `useRole()` call), and 6 internal call sites inside `mockData.ts` itself
  (`createClientFromApplication`, `createLoanAccountForClient`, `approveLoanAccount`,
  `activateLoanAccount`, and the module-level seed loop for sample applications).
- Bonus find while there: `createClientFromApplication()` itself turned out to be entirely dead
  (zero callers anywhere in the codebase, not even in `mockData.ts`) - left the function in place
  but dropped its now-unused `actorName` parameter to satisfy `noUnusedParameters`; a deeper look
  at whether the function should be deleted outright is future cleanup, out of scope here.

Typechecked clean (`noUnusedParameters`/`noUnusedLocals` caught every fallout immediately -
useful confirmation that nothing else silently depended on the removed code).

## Current State (supersedes Addendum 7's)

✅ About page changelog is now contiguous, one entry per release, current version `0.9.7`.
✅ `logActivity`/`MOCK_ACTIVITY_LOGS` dead code fully removed (was the last item on the mock-
removal punch list from Addendum 4).
⏳ Collections vs. Target (Dashboard) - still blocked on a business decision.
⏳ SMS/Email sending - still blocked on a provider, pending MIS Nomer.
⏳ `createClientFromApplication()` in `mockData.ts` - noticed to be fully dead code (zero
callers); not removed this session, flagged for a future pass.
⏳ Migrations `20260712050000_add_borrower_source_application` and `20260712060000_add_notes`
still need to run against the real database.

Committed and pushed to `origin/main` this session (see commit for hash).

---

# Addendum 9 — Activity Timeline fixes, sidebar cleanup, test-data script, final survey (2026-07-12)

**Trigger:** User: (1) fix the Activity Timeline everywhere; (2) remove the in-sidebar "hide side
panel" button; (3) provide a way to delete TEST loan applicant/client records so intake can be
retested; (4) continue the mock-removal effort; (5) save and sync; (6) "clean up."

## 1. `ProfileActivityTimeline.tsx` bug fixes (used by all 3 detail pages)

Three real bugs found and fixed:
- **Pagination replaced instead of accumulated**: `cursor` was part of the React Query `queryKey`,
  so each "Load more" fetch returned only its own page and the component rendered `data.activities`
  directly - the previously-loaded rows disappeared. Now accumulates into local state, appending
  new pages and resetting only when `profileType`/`profileId` actually changes.
- **Render-time side effect**: `if (error && onError) onError(...)` ran directly in the render
  body - a React rules-of-hooks violation, and would re-fire on every re-render. Moved into a
  `useEffect`.
- **Silent failure**: a fetch error fell through to the empty `activities.length === 0` state
  ("No activity recorded yet"), indistinguishable from a genuinely empty history. Added a real
  error message state.
- Also replaced hardcoded `gray-*`/`blue-*` Tailwind colors with the app's theme tokens
  (`text-muted-foreground`, `text-primary`, `bg-secondary/30`, `text-destructive`, etc.) - the
  component didn't respect dark mode before, unlike every other component in the app.

## 2. Sidebar cleanup

Removed the "Hide side menu" button that lived inside `Sidebar` itself
(`AppLayout.tsx`) - confirmed the `Topbar`'s own collapse/expand toggle already covers both
directions and was the *only* way to re-expand the sidebar once collapsed (the in-sidebar button
was one-way and disappeared along with the sidebar). No functionality lost.

## 3. TEST-record cleanup script

Wrote `app/backend/scripts/delete-test-records.ts` (dry-run by default, `--apply` to execute) -
matches any `LoanApplication.applicantName` or `Borrower.firstName`/`lastName` containing "TEST",
pulls in anything linked (the client an application produced, the loan account a client produced),
and deletes in FK-safe order (`LoanTransaction`/`RepaymentSchedule`/`AppliedFee` first - no cascade
on those - then `LoanAccount`, then polymorphic `Attachment`/`Note`/`Address` rows, then
`Borrower`, then `LoanApplication`). Deliberately leaves `AuditLog`/`ProfileActivityLog` alone.
**Not run from this session** - no DB access on this machine; user needs to run it (dry-run first)
wherever the real database lives.

Typechecked by temporarily including `scripts/**` in a copy of `tsconfig.json` (scripts aren't
covered by the normal `tsc -p .` check - confirmed this is true for every existing script in that
folder, not new to this one) - clean, then the temp config was discarded.

## 4. Final mock-data survey ("clean up" + continue)

Re-ran `grep -rl "from '@/lib/mockData'"` across the whole `src/` tree post-cleanup and cross-
checked every new hit not seen in earlier addendums:
- `ClientListPage.tsx`, `LoanListPage.tsx`, `LoanProductsPage.tsx` - each has exactly one hit, and
  it's a **past-tense doc comment** ("...replace `MOCK_BORROWERS`/`MOCK_LOANS`") documenting that
  the page *was already* migrated to real data in an earlier session - not an active mock
  dependency.
- `AppLayout.tsx` - `COMPANY_INFO` (static branch/company name), same category as `LoginPage`'s
  earlier-cleared hit - config, not fake business data.

**Conclusion: no further mock-to-real migration targets exist in the codebase right now.**
Everything remaining is one of: (a) intentional sample-data demo scaffolding for hand-authored
mock records (`ClientProfilePage`'s and `LoanDetailPage`'s mock code paths, `CreateLoanAccountDialog.tsx`,
`LoanDrillDownDialog.tsx`, `StatusBadge.tsx`, `PaymentMethodBadge.tsx` type/label imports) - removing
this entirely would be a deliberate design decision (drop the demo mode), not a bug fix, and hasn't
been asked for; (b) business-decision-blocked (Collections vs. Target); or (c) infrastructure-
blocked (SMS/Email provider). Also found and removed one more piece of confirmed dead code while
here: `createClientFromApplication()` in `mockData.ts` (flagged unused in Addendum 8, now deleted
outright along with its doc comment - zero callers anywhere).

Typechecked clean (frontend). Committed and pushed to `origin/main`.

## Current State

✅ Activity Timeline correct on all 3 pages that use it (Loan Application, Client Profile, Loan
Account).
✅ Sidebar has one working collapse control, not two.
✅ Cleanup script ready for MIS/Nomer to run against the real database.
✅ Confirmed via fresh full-codebase survey: mock-removal initiative has no further active targets
- remaining "mock" references are either intentional demo scaffolding, business-decision-blocked,
or infrastructure-blocked, not oversights.
⏳ If the intentional sample-data demo mode should eventually be removed entirely (not just have a
real path alongside it), that's a product decision for the user to make explicitly - flagged here,
not assumed.

---

# Addendum 10 — mockData.ts deleted entirely, Option A executed (2026-07-12)

**Trigger:** User asked what would happen under "Option A" (fully removing the sample-data demo
mode, not just having a real path alongside it - the deferred decision from the end of Addendum 9).
Explained the tradeoffs (loses the no-DB-needed preview mode on this machine; doesn't unblock
Collections vs. Target; some shared components needed their types redirected first) and
recommended doing it incrementally. User confirmed: "option A... mas gusto ko na connected talaga
ang LMS sa backend at real data na ang gagamitin."

## What shipped

**Type redirects** (`StatusBadge.tsx`, `LoanDrillDownDialog.tsx`): both imported `LoanAccountStatus`
from `mockData.ts` instead of the real `loanApiTypes.ts` - and the mock version had a `MATURED`
status value **the real backend has never had** (`schema.prisma`'s `LoanAccountStatus` enum has
always been 7 values, no `MATURED`). `DashboardPage.tsx`'s own code already knew this
("The real backend has no MATURED status yet... not tracked by the backend yet") but the shared
badge component didn't - a real type-safety gap, now closed. Added a missing exported
`RepaymentInstallmentStatus` type to `loanApiTypes.ts` (was only inlined before).

**Simplified `ClientProfilePage.tsx`, `LoanDetailPage.tsx`, `StatementOfAccountPage.tsx`** to
render their real view (`RealClientProfileView`/`RealLoanDetailView`/
`RealStatementOfAccountView`) unconditionally, deleting the entire mock-record code path each
page carried since the original Frontend↔Backend Wiring Pilot: `EditClientDialog`,
`getLoanSortValue`, the mock `NotesPanel`/`AttachmentsPanel`/`RemindersPanel` trio in
`LoanDetailPage.tsx`, the mock statement-of-account JSX, and every now-dead sort-value helper and
import. **Found and fixed a real regression in the process**: deleting the mock
`LoanDetailPage()` wrapper revealed it was the *only* place rendering the Activity Timeline and
Recent Activity panel for loan accounts - `RealLoanDetailView` never had them. Added both to the
real view rather than just deleting the dead code, so the feature isn't lost.

**Deleted `CreateLoanAccountDialog.tsx`** outright - confirmed zero importers anywhere once
`ClientProfilePage.tsx`'s mock path was gone.

**Extracted genuine static config** into a new `src/lib/staticConfig.ts`: `COMPANY_INFO`,
`ACTIVE_PAYMENT_METHODS`/`DISCONTINUED_PAYMENT_METHODS`/`getPaymentMethodLabel`/
`isDiscontinuedPaymentMethod`, `INTAKE_DOCUMENT_OPTIONS`, `LmsRole`. These were never fake
business data - real, fixed reference values (company identity, a fixed payment-method catalog,
staff role names) that happened to live in the mock file. Updated 7 importers
(`PaymentMethodBadge.tsx`, `AppLayout.tsx`, `LoginPage.tsx`, `LoanApplicationCreatePage.tsx`,
`MemberListPage.tsx`, `PaymentRecordingPage.tsx`, and `roleContext.tsx` - found via a build error,
missed in the initial grep since its import line wrapped differently) to the new file.

**`DashboardPage.tsx`'s Collections vs. Target**: inlined `COLLECTIONS_VS_TARGET` directly into
the page itself as a clearly-commented placeholder (still blocked on the same business decision as
Addendum 3/4) rather than migrating it to `staticConfig.ts` - it's disclosed sample data, not real
config, and moving it to a "config" file would have misrepresented what it is.

**Deleted `src/lib/mockData.ts` entirely** (was ~3,050 lines) once its last real importer was
migrated. Worth noting why this specific deletion mattered beyond code cleanliness: the file's own
top-of-file comment disclosed it paired **real customer names** (sourced from the legacy MLR
Master List) with **entirely fabricated financial figures**, and explicitly warned "THIS BUILD
MUST NOT BE DEPLOYED PUBLICLY OR SHARED OUTSIDE AN INTERNAL PREVIEW AUDIENCE." With no code path
left rendering it anywhere, deleting it removes a real name/fake-data privacy liability from the
repo, not just dead weight.

Also fixed a stale doc comment in `App.tsx` (still claimed several routes were mock-only when they
were actually real as of earlier addendums this session) and in `DateRangeFilter.tsx` (claimed to
filter a mock dataset that no longer exists).

Typechecked clean after every step. Booted the dev server and confirmed the login page renders
correctly (real `COMPANY_INFO` from the new `staticConfig.ts`, no console errors) - full
authenticated verification still not possible from this machine (no DB access).

## Current State

✅ **`mockData.ts` no longer exists.** Zero sample/demo data code paths remain anywhere in the
frontend - every page renders exclusively from real backend data.
✅ Fixed a real type-safety bug (`MATURED` status that never existed on the real backend) and a
real regression (Activity Timeline missing from the real Loan Account view) discovered while doing
this cleanup.
✅ Genuine static config (`staticConfig.ts`) is clearly separated from anything resembling sample
data.
⏳ Collections vs. Target (Dashboard) - still explicitly disclosed placeholder data, now inlined
in `DashboardPage.tsx` itself, still blocked on a business decision (how a real monthly collection
target gets set).
⏳ SMS/Email sending - still blocked on a provider, pending MIS Nomer.
⏳ Migrations `20260712050000_add_borrower_source_application` and `20260712060000_add_notes`
still need to run against the real database.

**This closes the mock-data-removal initiative that ran through this entire session (Addendums
1-10).** Every remaining known gap is either a business decision or external infrastructure, not
a wiring task.
