# ADR-050: Profile Activity Timeline — Loan Officer Activity Tracking

**Status:** ACCEPTED  
**Date:** 2026-07-12  
**Decision Drivers:** Compliance, auditability, staff accountability

---

## Problem

Loan officers interact with Loan Applications, Client Profiles, and Loan Accounts to:
- Upload/remove attachments (documents)
- Update pre-qualification status / approve/decline applications
- Add/edit notes
- Record payments and allocations

Currently, there is no way to see which officer performed which action on which profile. This creates compliance gaps and makes it impossible to audit officer activity.

---

## Proposed Solution

Create a **Profile Activity Timeline** — a separate activity log tied specifically to three entity types (LoanApplication, Borrower/Client, LoanAccount) that records:

1. **Who** — the loan officer (User)
2. **What** — the action (attachment_created, decision_updated, note_created, payment_recorded, etc.)
3. **When** — timestamp
4. **Where** — which profile (loan application ID, borrower ID, loan account ID)
5. **Details** — what changed (JSON, including before/after for updates)

### Core Principles

- **Immutable after creation** — activity records cannot be edited, only viewed or deleted by MIS
- **Kept forever** — no automatic purging
- **Queryable per profile** — each profile shows its own activity timeline
- **MIS deletion only** — regular staff cannot delete activity records
- **Universal visibility** — all staff can see activity (with future MIS-controlled visibility restrictions)
- **Payment detail tracking** — records which officer allocated payment to principal/interest/fees

---

## Data Model

### ProfileActivityLog Table

```sql
CREATE TABLE profile_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What entity was affected
  profile_type ENUM('LOAN_APPLICATION', 'BORROWER', 'LOAN_ACCOUNT'),
  profile_id UUID NOT NULL,
  
  -- Who did it
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- What happened
  action VARCHAR NOT NULL,
  -- e.g., "attachment_created", "decision_updated", "note_created", 
  --       "payment_recorded", "attachment_deleted", "note_updated"
  
  -- Details of the change (JSON)
  details JSONB NOT NULL,
  -- Example for attachment_created:
  --   { "attachmentId": "...", "documentCategory": "VALID_ID_BORROWER", "fileName": "ID.pdf" }
  -- Example for decision_updated:
  --   { "fromStatus": "PENDING", "toStatus": "APPROVED", "reason": "..." }
  -- Example for payment_recorded:
  --   { "paymentId": "...", "amount": 1000, "principal": 800, "interest": 150, "fees": 50,
  --     "repaymentInstallmentId": "...", "allocationBreakdown": {...} }
  -- Example for note_created:
  --   { "noteId": "...", "content": "..." }
  
  visibility_restricted BOOLEAN DEFAULT FALSE,
  -- If true, MIS can later choose to hide this from non-MIS users
  -- (not implemented yet, but future-proofed)
  
  created_at TIMESTAMP DEFAULT now(),
  deleted_by_mis_at TIMESTAMP NULL,
  -- Soft delete: if set, only MIS can see that this was deleted
  
  CONSTRAINT profile_activity_logs_profile_id
    CHECK (profile_type IS NOT NULL AND profile_id IS NOT NULL),
  
  INDEX idx_profile_activity_logs_profile (profile_type, profile_id),
  INDEX idx_profile_activity_logs_user_id (user_id),
  INDEX idx_profile_activity_logs_created_at (created_at)
);
```

---

## Action Types

Activities logged for each profile type:

### LoanApplication
- `attachment_created` — officer uploaded a document
- `attachment_deleted` — officer removed a document
- `decision_updated` — pre-qualification status changed (PENDING → APPROVED/PREDECLINED) or officer decision changed (APPROVED/DECLINED/REVERTED)
- `note_created` — officer added a note
- `note_updated` — officer edited a note
- `note_deleted` — officer removed a note

### Borrower (Client Profile)
- (Inherits all Loan Account activities for active loans)
- Future: profile data edits, contact info changes, etc.

### LoanAccount
- `payment_recorded` — payment submitted and processed
- `attachment_created` — officer attached a document
- `attachment_deleted` — officer removed a document
- `note_created`, `note_updated`, `note_deleted`
- `decision_updated` — loan status changed (activate, close, etc.)

---

## Integration Points

### Backend Hooks

1. **Attachment Upload** (via `DocumentModule`)
   - When: `POST /loan-applications/:id/attachments` or `/loan-accounts/:id/attachments`
   - Log: `attachment_created` with attachment ID, document category, file name

2. **Attachment Delete**
   - When: `DELETE /attachments/:id`
   - Log: `attachment_deleted` with attachment ID, previous category

3. **Loan Application Decision** (via `ApproveLoanApplicationUseCase`, `DeclineLoanApplicationUseCase`, `RevertLoanApplicationUseCase`)
   - When: officer approves/declines/reverts a loan application
   - Log: `decision_updated` with from_status → to_status, reason

4. **Note CRUD** (future, or via generic note endpoint)
   - Log: `note_created`, `note_updated`, `note_deleted`

5. **Payment Recording** (via `ProcessPaymentUseCase`)
   - When: `POST /loan-accounts/:id/payments`
   - Log: `payment_recorded` with payment ID, amounts, allocation breakdown, which officer

---

## Frontend Integration

### UI Components

- **Timeline Tab** on:
  - `LoanApplicationDetailPage` — shows all activities on that application
  - `ClientProfilePage` — shows activities across all borrower's applications and loans
  - `LoanDetailPage` — shows all activities on that loan account

- **Timeline Entry** component:
  - Officer name + role
  - Action label (readable, e.g., "Approved application", "Uploaded ID")
  - Timestamp
  - Details (collapsible JSON for power users, or summarized display)
  - (Future) MIS-only delete button

### Example Timeline Entry

```
2026-07-12 14:32:00 — Jomer Biason (MIS Assistant)
Uploaded valid ID
VALID_ID_BORROWER / ID_Juan_Dela_Cruz_2026.pdf

---

2026-07-12 15:45:00 — Marian Navarro (Loan Officer)
Approved application
Pre-qualification: PREAPPROVED → APPROVED (Officer Override)

---

2026-07-12 16:20:00 — Grace Santos (Loan Officer)
Recorded payment
Amount: ₱2,500 | Principal: ₱2,000 | Interest: ₱500
Installment: #2 of 12 | Due: 2026-07-15
```

---

## API Endpoints

### Read Activity

```
GET /loan-applications/:id/activity
GET /borrowers/:id/activity
GET /loan-accounts/:id/activity

Query params:
  ?limit=50 (default 50)
  ?cursor=<id> (pagination)
  ?action=payment_recorded (filter by action type)

Response:
  {
    activities: [
      {
        id: "...",
        profileType: "LOAN_APPLICATION",
        profileId: "...",
        user: { id, firstName, lastName, role },
        action: "payment_recorded",
        details: { paymentId, amount, principal, interest, fees, ... },
        createdAt: "2026-07-12T14:32:00Z",
        deletedByMisAt: null
      },
      ...
    ],
    cursor: "..." (for pagination)
  }
```

### Delete Activity (MIS Only)

```
DELETE /profile-activity/:id

Authorization: MIS role required

Response: 204 No Content
```

---

## Implementation Roadmap

### Phase 1: Data Layer
1. Create migration `add_profile_activity_logs_table`
2. Create domain models / value objects if needed
3. Create `IProfileActivityLogRepository` port
4. Create `PrismaProfileActivityLogRepository` implementation

### Phase 2: Application Layer
1. Create `ProfileActivityLogService` (application service)
2. Create domain service / use case to log activities
3. Wire into existing use cases (payment, attachment, decision)

### Phase 3: HTTP Interface
1. Create `ProfileActivityLogController` and router
2. Create presenters for timeline display
3. Add MIS-only authorization checks

### Phase 4: Frontend
1. Add `useProfileActivity` hook (TanStack Query)
2. Create `ProfileActivityTimeline` component
3. Add "Activity" tab to each profile page
4. Add timestamp formatter for PH timezone

---

## Future Enhancements

1. **Visibility Control** — MIS can mark certain activities as visible-to-MIS-only
2. **Activity Filtering** — filter by action type, date range, officer
3. **Activity Search** — full-text search on details
4. **Bulk Export** — export timeline as CSV/PDF for compliance reporting
5. **Webhooks** — notify on specific actions (e.g., "loan approved")
6. **Real-time Timeline** — WebSocket updates as activities are logged

---

## Backward Compatibility

No breaking changes. New table is additive. Existing AuditLog table remains unchanged.

---

## References

- [[project_overview]] — Current profile features
- [[ADR-038-full-permission-matrix]] — RBAC roles and visibility
- docs/SESSION_LOG_2026-07-11.md — Decision to track officer actions per profile
