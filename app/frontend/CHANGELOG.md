# Frontend Changelog — Milestone 9.1 UI Preview Build

Scope note: everything in this changelog is a **CEO-facing UI preview** built against
hand-authored mock data in `src/lib/mockData.ts`. It exists to demonstrate layout, navigation, and
interaction flow before the real backend HTTP API (`app/backend` CP13) is wired up. **No entry
below touches `app/backend` or any real database.** See the "Preview Mode" banner rendered in the
app itself, and the top-of-file comment in `src/lib/mockData.ts`, for the same disclosure.

## 2026-07-07

### Dashboard — filters + dynamic totals on Portfolio Breakdown and Loan Portfolio Health
- New shared **Portfolio Filters** card (Loan Category + date-range) sits above both widgets and
  drives them together: **Portfolio Breakdown by Loan Category** (pie) and **Loan Portfolio
  Health** (Venn diagram) now recompute their loans, counts, and every ₱ total live against the
  active filter — including the per-segment Interest Income / Accrued Revenue / Credit Loss
  figures. A summary line reports "Showing N active loan accounts · ₱X total outstanding
  principal" for whatever is currently in scope, and each card's drill-down dialog reflects the
  filtered set too. Reset button clears back to the whole portfolio.
- `src/lib/mockData.ts`: `buildPortfolioHealth()` and `buildPortfolioByCategory()` are now
  exported, reusable builder functions (previously private, MOCK_LOANS-only) so the Dashboard can
  call them against any filtered loan subset; `PORTFOLIO_HEALTH`/`PORTFOLIO_BY_CATEGORY` remain as
  the portfolio-wide baseline used by the (unfiltered) Quality Metrics and Recommendation cards.
  New `LOAN_CATEGORY_OPTIONS` export for the filter dropdown.

### Dashboard — "AI Portfolio Assist" renamed to "Recommendation"
- Same three per-segment plans (Maintain / Protect the margin / Resolve), same disclosure text —
  only the card title changed, per business instruction.

### Back buttons now use browser history instead of a hard-coded destination
- Every "Back to X" button (Loan Account Detail, Loan Application Detail, Client Profile,
  Statement of Account) now calls `navigate(-1)` instead of a hard-coded route, so it returns to
  wherever the user actually came from — list, search result, or another detail page — instead of
  always resetting to a blank list. Label shortened to "Back" since the destination is no longer
  a fixed, nameable page.

### About page — company/product info update
- LMS name corrected to **Easycash Loan Management System Platform** (`LMS_APP_NAME`).
- New **Developer Team — Easycash Dev** card: Jomer Biason (MIS Assistant — Vibe Coder and
  Programmer) and Nomer Perez (MIS Manager — Reviewer).
- New **Easycash Portal** card — informational disclosure of the planned future client-facing
  app/website (`easycashportal.ph`): online loan application, status, transaction history,
  payments, tracker, and customer service contact. Explicitly labeled "Planned — not yet built";
  nothing in this LMS links to it.
- Details grid gained a "Developed by" fact.

### About page (new, under Administration) — LMS version number + changelog
- Added `/admin/about`: an app-store-style About page — logo, app name, version badge, an "About
  this app" description of the platform's modules, a Details grid (version, updated/released
  dates, offered-by, environment), and a **What's New — Changelog** section listing prior releases
  newest-first.
- New single source of truth for the version/changelog: `src/lib/lmsVersion.ts`
  (`LMS_VERSION`, `LMS_CHANGELOG`, `LMS_ABOUT_SECTIONS`, `LMS_ABOUT_FACTS`). Bump the version and
  prepend a changelog entry here whenever a user-visible release ships — this is the
  stakeholder-facing history, separate from this developer-facing `CHANGELOG.md`.
- Current version: **0.9.1** (pre-1.0, reflecting the Milestone 9.1 UI-preview stage). The sidebar
  footer now reads the same version (`v0.9.1`) instead of a hard-coded "Milestone 9.1" string, so
  the two can never drift out of sync.
- "About" added as the last item under the Administration sidebar group.

### Loan Portfolio Health — per-segment income/loss figures + shorter overlap label
- Each summary card now shows a labeled financial figure computed live from the sample portfolio,
  giving a collected → accrued → at-risk revenue narrative:
  - **Good → Interest Income** (realized interest revenue already collected from performing
    accounts) = sum of interest paid.
  - **In Arrears → Accrued Revenue** (interest earned but not yet remitted; penalty/late-fee
    income is still called out separately in the card text) = sum of interest balance.
  - **Matured → Credit Loss** (unpaid principal at risk of loss now that the loan is past its full
    term) = sum of principal balance.
- The Venn overlap label was shortened from the two-line "Active Accounts / in Arrears" to a
  single **"In Arrears"** so it fits inside the lens; the In-Arrears summary card title was
  shortened to match. (`PORTFOLIO_HEALTH` gained `interestIncome` / `accruedRevenue` /
  `creditLoss` in `src/lib/mockData.ts`.)

### Venn diagram — third segment is now "Matured" (distinct from Closed), green/yellow/red color code
- Per business clarification, the Venn's third circle is now **Matured Loan Accounts** (red), a
  new distinct loan status `MATURED`: an **active** loan that has passed its full maturity date
  but is still unpaid, carrying an outstanding balance — the highest-risk active segment. This
  is deliberately **different from a Closed account**: `CLOSED` = reached maturity AND settled
  successfully (a separate, healthy outcome, not shown as a Venn circle). Written-off loans
  (`CLOSED_WRITTEN_OFF`) are likewise no longer a Venn segment — they remain behind the Write-off
  exposure quality metric and its drill-down.
- Venn color code is now: **Green = Good, Yellow = Active Accounts in Arrears (overlap), Red =
  Matured**. The `LoanStatusBadge` was aligned to match — In Arrears is now `warning` (yellow)
  and the new Matured status is `destructive` (red).
- `MATURED` is a first-class status across the mock model: two sample accounts (origination
  pushed past their full term), timeline event, High-Risk assessment, included in Total Active
  Loans / Portfolio Breakdown / the Delinquency Rate & Portfolio-at-Risk metrics (matured loans
  count as delinquent/at-risk). The AI Portfolio Assist plan for this segment is now **Resolve**
  (escalate to intensive collection / restructuring before the loss is realized).

### Venn diagram — "Sweet Spot" renamed to "Active Accounts in Arrears"
- The Loan Portfolio Health overlap segment is now labeled **Active Accounts in Arrears**
  (per business instruction) everywhere: the SVG overlap, the summary card, the AI Portfolio
  Assist badge, and `PORTFOLIO_HEALTH`'s internal key (`sweetSpot` → `activeInArrears`).
  The business meaning is unchanged — still active and paying, just sometimes late, generating
  penalty/late-fee income on top of amortization — and the new name is also the
  industry-standard term (an account "in arrears" is overdue but not in default).

### Dashboard — 3 loan categories only; SML rolls up under Seafarer Loan
- Portfolio Breakdown now groups by the 3 active loan CATEGORIES (Salary Loan, Seafarer Loan,
  Business Loan) instead of per sub-type product names. Every SML-* product — active or
  discontinued (SML-Regular, SML-Max, …) — is a sub-class of **Seafarer Loan** (a.k.a. Seaman
  Loan) and rolls up under it (`getDashboardLoanCategory` in `src/lib/mockData.ts`); a
  defensive "Other (Legacy)" bucket exists so no non-SL/BL/SML legacy loan could ever silently
  vanish from a chart total.

### Clickable charts — drill down to the accounts behind every figure
- New shared `LoanDrillDownDialog`: clicking a Venn region/summary card, a Portfolio Breakdown
  pie slice or legend entry, a Loan Disbursement Trend bar, the Total Active Loans / Overdue
  Accounts summary cards, or a Portfolio Quality Metric value opens a dialog listing exactly
  which loan accounts make up that analytics figure — each row links to the full Loan Account
  detail page. Charts with no account-level mapping (Collections vs. Target, Collections
  Forecast — target/projection lines over sample aggregates) deliberately stay non-clickable
  rather than pretending to drill down.
- Mock-data note: loan origination dates are now spread from ~3 weeks to ~23 months ago
  (previously 200+ days minimum) so the "last 6 months" disbursement bars have real accounts
  behind them instead of a permanently empty drill-down.

### Sidebar — new section order, theme-aware colors
- Sections/tabs reordered per business instruction: **Home** (Dashboard, Loan Report,
  Collection Report, Transaction Report), **Loan** (Loan Applications, Client Data, Loan
  Accounts), **Collection** (Payment Recording, Payment Reminders), **Administration**
  (LMS Configuration, Member Details, Generated Documents, Loan Products, Activity Logs).
- The sidebar (section tab area) is now theme-aware: light surface in light mode, dark in dark
  mode (previously a fixed dark blue in both), and the active-tab highlight follows the
  selected theme color.

### LMS Configuration (new page, MIS-only)
- `/admin/configuration` — MIS-only settings page: **Theme Color** (5 presets — **Easycash
  Emerald (default)**, Easycash Blue, Violet, Amber, Rose — applied instantly across buttons,
  active section tabs, links, and the primary chart series in both light and dark mode) and
  **Appearance** (light/dark switch). Preferences persist locally (preview build; a real
  implementation would persist per-user via the backend). Theme-color changes are written to
  the Activity Log (`CHANGE_THEME_COLOR`). Non-MIS accounts get the standard restricted-access
  card.

### Default theme color set to Easycash Emerald; company-name casing fixed
- The platform's default theme color is now **Easycash Emerald** (business-confirmed), not the
  legacy Easycash Blue — first load applies emerald out of the box (`DEFAULT_ACCENT` in
  `theme-provider.tsx`); Easycash Blue remains selectable as a preset.
- Corrected all user-facing casing of the company name to the official **Easycash** (was
  "EasyCash") — logo alt text, AI-summary copy, and theme-preset labels. Official business name
  is "Easycash Lending Company Inc." (`COMPANY_INFO.name`, already correct).

### Generated Documents (new page, under Administration)
- `/admin/documents` — mock registry of the official documents produced when a loan account is
  activated (Promissory Note, Disclosure Statement, Loan Agreement, Amortization Schedule —
  matching the company's real legal templates). Sortable/filterable table (default
  recent-to-oldest), rows link to the loan account; metadata only, downloads disabled in this
  preview.

### Investopedia-informed portfolio analytics
- New **Portfolio Quality Metrics** dashboard card applying industry-standard lending
  indicators (as taught on Investopedia — the site itself blocks automated access, so the
  standard definitions were corroborated via other industry sources): **Delinquency Rate**
  (count-based, in-arrears ÷ active accounts), **Portfolio at Risk** (balance-weighted,
  arrears outstanding ÷ total outstanding), **Average Loan Size**, and **Write-off exposure**
  — all computed live from the sample portfolio, all clickable through to the accounts behind
  them.
- New `TermTip` component + `src/lib/financialGlossary.ts`: every metric carries an ⓘ hover
  tooltip with the plain-language definition of the term (Delinquency Rate, PAR, In Arrears,
  Write-off, Amortization, Penalty/Late Fee), explicitly noted as standard industry
  definitions computed against sample data.

## 2026-07-06

### Dashboard — Loan Portfolio Health (Venn diagram + mock AI Assist)
- Added a "Loan Portfolio Health" card to the Dashboard: a two-circle Venn diagram plotting
  **Good Loan Accounts** (`ACTIVE`, paying on schedule, no penalty fees) against **Bad Loan
  Accounts** (`CLOSED_WRITTEN_OFF`, defaulted/unrecoverable), with the overlap explicitly labeled
  **Sweet Spot** — accounts that are `ACTIVE_IN_ARREARS`: still active and still paying, just
  sometimes late, so the company earns real penalty/late-fee income on top of amortization
  (confirmed business intent, not a data-quality problem to fix away). All counts/₱ values are
  computed from the existing `MOCK_LOANS` array (`PORTFOLIO_HEALTH` in `src/lib/mockData.ts`) —
  no new mock loan records were added.
- Added a companion **"AI Portfolio Assist"** card below it: three static, hand-authored
  recommendation blocks (Maintain / Protect the margin / Resolve, one per segment), carrying the
  same "AI-Assisted — draft discussion points for management, not automated actions... static
  mock... not yet connected to an API for a real AI Assist engine" disclosure already used by the
  Loan Applications AI Risk Assessment panel.
- New reusable component: `src/components/LoanPortfolioVennDiagram.tsx`.

### Sortable column headers across every table
- Added click-to-sort column headers (with an ascending/descending indicator icon) to every
  `<Table>` across the LMS preview: Activity Logs, Client Data, Client Profile (Loan History),
  Collection Report (daily/monthly/yearly), Loan Applications, Loan Account Detail (Repayment
  Schedule + Payment History), Loan Accounts list, Loan Products (active + discontinued, grouped
  by category), Loan Report (daily/monthly/yearly), Member Details, Payment Recording (Automatic
  allocation preview), Payment Reminders, Statement of Account, and Transaction Report.
- **Any Date/timestamp column always opens sorted recent-to-oldest (descending)** by default —
  Date & Time, Created, Due Date, Submitted, Last Login, Date, etc. — per the standing requirement
  that date columns default to showing the newest entries first. Clicking a column header again
  toggles between ascending/descending; clicking a different column switches the active sort to
  that column instead (non-date columns default to ascending on first click).
- New shared building blocks: `useSortableTable` (`src/lib/useSortableTable.ts`) and
  `SortableTableHead` (`src/components/ui/sortable-table-head.tsx`) — one hook + one header
  component reused by every page, instead of duplicating sort logic per table.
- Payment Recording's Automatic allocation table is sorted for **display only** — the underlying
  fees → penalty → interest → principal calculation (ADR-009) still always runs against
  installments in oldest-due-first order regardless of how the table is currently sorted, since
  changing the calculation's input order would change the actual allocation, not just how it's
  shown.
- Loan Products' grouped/expandable tables (Active, Discontinued) sort within their existing
  category grouping rather than flattening it.

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
  Applicant" badge, and for repeat clients, lists their previous Easycash loan account(s) —
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
