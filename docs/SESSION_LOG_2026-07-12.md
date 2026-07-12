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
