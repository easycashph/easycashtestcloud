# Frontend Changelog — Milestone 9.1 UI Preview Build

Scope note: everything in this changelog is a **CEO-facing UI preview** built against
hand-authored mock data in `src/lib/mockData.ts`. It exists to demonstrate layout, navigation, and
interaction flow before the real backend HTTP API (`app/backend` CP13) is wired up. **No entry
below touches `app/backend` or any real database.** See the "Preview Mode" banner rendered in the
app itself, and the top-of-file comment in `src/lib/mockData.ts`, for the same disclosure.

## 2026-07-06

### Payment Recording — manual allocation mode
- Added an **Allocation** toggle (Automatic / Manual) to the Payment Recording screen.
  **Automatic** is the existing behavior (fees → penalty → interest → principal, oldest
  installment first, per ADR-009). **Manual** lets staff type in exactly how much of the payment
  applies to Principal, Interest, Penalty, and Fees, instead of relying on the automatic engine.
- Manual mode includes a "Copy automatic split" shortcut (prefills the four fields from what the
  automatic engine would have applied, still editable) and a live mismatch check comparing the
  four manually-entered amounts against the total payment amount, flagging any unallocated or
  over-allocated difference.
- The Allocation Preview panel switches accordingly: per-installment table for Automatic, a
  simple component-totals summary for Manual (explicitly noted as not yet mapped to specific
  installments — that decision is deferred to whenever CP13 wiring reaches this screen).
- Mock/preview only, same as the rest of this screen — no `app/backend` change, no real posting.

### Loan Applications — attachments, AI summary, repeat-client detection
- Restricted Loan Application attachment file names to documents an applicant would actually
  submit at intake (photo, valid IDs, Employee ID, Corporate Payslip, Latest Proof of Billing,
  Driver's License, Passport, KYC/credit bureau report, and Seafarer-specific docs). Removed
  documents that only exist for an already-approved official loan account (Promissory Note, Deed
  of Assignment, Disclosure Statement, Loan Agreement, Special Power of Attorney, Data Privacy and
  Consent Form, Manulife insurance) — those now only ever appear on the Loan Account itself.
- Expanded the AI Risk Assessment output into a fuller summarized recommendation (still a static,
  hand-authored mock — explicitly labeled "not yet connected to an API for a real AI Assist
  engine").
- Added **Repeat Client detection**: the applicant detail page now shows a "Repeat Client" / "New
  Applicant" badge, and for repeat clients, lists their previous EasyCash loan account(s) —
  clicking one opens its full repayment schedule (the "monthly payment report"). Added two
  demonstration scenarios: a good payer (loan paid in full, no late installments) and a delinquent
  one (loan written off, partial payment history, with a recorded reason). The AI summary
  references this payment history directly when present.

### Loan Application → Client → Loan Account workflow
- Added **profile pictures and uploaded-attachment lists** to Loan Applications and Client
  Details, sourced from real historical applicant folders under `legacy/sdevtech/` (per explicit
  instruction) — only a curated photo subset was copied into `public/applicants/`; attachment
  entries show file name/size only, never real document content, and "Download" stays disabled.
- Added a **"Create Client"** action on Approved applications (confirmation dialog required) that
  copies the applicant's profile picture, personal/contact info, address, and attachments into an
  official Client Details record.
- Added a **"Create Loan Account"** action on Client profiles (confirmation dialog required),
  gated to MIS / Loan Operation Manager / CRM. Enforces the business rule that a client may never
  have two simultaneously ACTIVE/ACTIVE_IN_ARREARS loan accounts.

### Activity Logs — broadened and access-restricted
- Activity Logs are now visible **only to MIS** (previously MIS + Loan Operation Manager).
- Every major section (Dashboard, Loan Accounts, Loan Applications, Client Data, Loan Products,
  Payment Recording, Reports, Payment Reminders, Member Details, and individual Loan
  Account/Application detail pages) now logs page views and shows a MIS-only "Recent Activity"
  panel (recent-to-oldest) at the bottom of the page.
- Logging extended to cover: viewing a section, adding a note, uploading/deleting an attachment,
  creating a client, creating a loan account, adding/editing an LMS member, and all existing Loan
  Application actions. Every entry now records both date and time.

### Loan Applications — review workflow safety and roles
- Added a **CRM** role (staff: Rosemarie Tenchavez) with the same Loan Application access as Loan
  Operation Manager (assign product sub-type, approve, decline) — but, like Loan Operation
  Manager, CRM can never revert a decision once made.
- Added a confirmation dialog before every Approve/Decline action (safety net against an
  accidental click) for CRM and Loan Operation Manager.
- Added an MIS-only **"Revert to Pending Review"** action on already-decided applications.
- Added a Gmail-style **Reviewed / Pending Review** toggle on the applications list — independent
  of the approve/decline decision — with per-row and "select all" bulk toggling.

## 2026-07-05

### Payment Reminders (new module)
- Added an automatic payment reminder schedule: 5 days before due, 3 days before, 1 day before,
  on the due date, and weekly while past due. Sent via SMS and Email (both simulated); a third
  channel — the client's own Easycash account dashboard — is always shown as "Coming Soon" since
  it depends on the not-yet-built public client portal.
- Added a system-wide "Payment Reminders" list page and a per-loan "Reminders" tab on the Loan
  Account Detail page, both with a Sent/Scheduled indicator and a full message preview (Client
  Name, Loan Account Code, amount due, payment progress, and penalty fees when past due).

### Loan Applications (new module)
- Added a Loan Applications list + detail flow representing intake from the future public
  Easycash loan-application website (not built yet). Each application carries a static AI Risk
  Assessment (Low/Medium/High) with a pass/fail factor breakdown (age 18–55, address, income,
  credit score, properties) and a plain-language recommendation, always labeled AI-assisted /
  human-decided, never autonomous.
- Staff (not the client) assign the specific product sub-type during review, before approving.
- Access restricted to MIS, Loan Operation Manager, and (later) CRM.

### Loan Products & account codes
- Restructured Loan Products to 3 active categories confirmed by the business: Salary Loan (3
  sub-types — Corporate Tie-up, Regular, Special/repeat-client discount), Business Loan (1
  sub-type), Seafarer Loan (1 sub-type). Loan Products list now groups sub-types under their
  parent category.
- Corrected the account-code convention to `{CATEGORY}-{SubType}_{4-digit sequence}` (e.g.
  `SL-Corp_0001`), sequential per prefix, matching the real legacy naming convention.

### Staff roster, roles, and account switching
- Replaced the placeholder staff roster with the confirmed real roster: Jomer A. Biason (MIS),
  Nomer D. Perez (MIS), Liezel Pentecostes (Loan Operation Manager), Mariel Deguzman (Finance),
  Kyla Sobel (Accounting), Rosan Cinco (Collection Officer).
- Replaced the abstract "Viewing as: Role" dropdown with a real **"Switch Account"** panel showing
  each named staff member (with a decorative, disabled username/password section) — selecting an
  account changes the signed-in identity and, live, what that account can access.
- Confirmed access policy: MIS is super user (all access, including reverting a Loan Application
  decision and managing LMS members); Loan Operation Manager/CRM get the same base access as
  Finance/Accounting/Collection Officer plus Loan Application access; Finance/Accounting/
  Collection Officer cannot access Loan Applications or manage members.

### Environment
- Fixed a dev-server port conflict (`.claude/launch.json` now uses `autoPort: true` instead of a
  hard-coded, `--strictPort` port) so a busy port no longer blocks the preview server from
  starting.
- Added `Run LMS Preview.bat` — a standalone script (double-click, no Claude Code required) that
  installs dependencies on first run, starts the Vite dev server in its own window, and opens the
  preview in the default browser.

## Earlier (pre-existing at start of this changelog)

The bulk of the UI preview (Dashboard, Loan Accounts list/detail, Client Data, Payment Recording,
Loan Products catalog, Reports, LMS Administration/Member Details/Activity Logs, Preview Mode
banner, light/dark theme, real company branding) was already built and verified working before
the entries above; see `docs/PROJECT_HANDOFF.md` for the separate `app/backend` implementation
history (unrelated track — the backend is not yet wired to this frontend).
