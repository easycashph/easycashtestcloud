# Session Log — 2026-07-17 (Settings/Appearance Overhaul + Notification Center)

Continues from `docs/SESSION_LOG_2026-07-16_to_2026-07-17.md`. Covers a full day's work across
several distinct pieces of work in one session.

## What was done, in order

1. **List-row-to-dialog experiments (Loan Applications, Clients, Loan Accounts) — reverted.**
   Explored converting each list page's row click from `navigate(...)` to opening the detail page's
   content inside a Dialog (mirrors an earlier pattern). User didn't like the look and asked to
   revert. Confirmed nothing had been committed or pushed (`git status` was clean before any of it),
   so a plain `git checkout` on the touched files fully reverted it - no commit history to undo.

2. **Legacy `LoanAccount.activatedAt`/`createdAt` data-quality bug — fixed and shipped.** User
   reported two things labeled "Disbursement Date" on a loan account, one with 0 principal. Root
   cause: `migrate-legacy-data.ts` sourced `activatedAt` (the app's official Disbursement Date -
   ADR-032) from the legacy loan account's own `creationDate`, never from the real
   `disbursements.disbursment_date` field. Verified against the raw legacy dump: 1,131/1,798 legacy
   loans differed by >1 day. Separately, `createdAt` was never set from legacy data at all (defaulted
   to the migration run's own timestamp). Fixed both:
   - `scripts/backfill-legacy-disbursement-dates.ts` (new, idempotent, dry-run-by-default) - ran
     `--apply` against local dev Postgres, corrected 1,754 rows' `activatedAt`.
   - `scripts/backfill-legacy-loan-created-dates.ts` (new, same pattern) - corrected 1,783 rows'
     `createdAt` from `loan_accounts.creationDate`.
   - `migrate-legacy-data.ts` itself fixed so a future re-migration sources both fields correctly.
   - Committed (`07fec60`) and pushed to `origin/main` at the user's request.
   - An earlier theory (zero-principal `DISBURSEMENT` transactions = the true creation date) was
     checked against real data and **ruled out**: only 21% of loans have one, and 80% of those
     postdate the real disbursement - not a creation-time event, some other administrative/batch
     event. User confirmed to fall back to `loan_accounts.creationDate` instead once shown this.

3. **Git/GitHub status update** - reported per the standing `feedback_status_updates` preference:
   commit authorship (first-ever commit from MIS Nomer's account seen in this repo, alongside
   Jomer's), pull-needed verdict (in sync), and a feature-status summary anchored on the actual
   session log rather than stale memory.

4. **Settings/Appearance Overhaul** - user asked for suggestions to make the LMS more
   personality-customizable per loan officer, then asked to build all of them one by one:
   - **Dashboard Layout preference** - new `dashboard-layout-provider.tsx` (per-user localStorage,
     same pattern as `theme-provider.tsx`), refactored `DashboardPage.tsx`'s 4 stat cards into a
     config-driven render keyed by `DashboardCardId`, new "Dashboard Layout" card in Settings >
     Appearance (compact/comfortable density switch, per-card up/down reorder + show/hide, reset).
   - **Text Size preference** - `theme-provider.tsx` gained a `fontSize` state (`small`/`medium`/
     `large`), driving `[data-font-size]` on `<html>` → `index.css` scales root `font-size`
     (87.5%/100%/112.5%), so every `rem`-based Tailwind utility scales app-wide. New "Text Size" card
     in Settings > Appearance.
   - **Landing Page preference** - new `lib/landingPagePreference.ts` (plain read/write module, not
     a context - read once per login). `App.tsx`'s index route (`/`) is now `IndexRedirect`, which
     reads the signed-in officer's preferred page (Dashboard/Loan Applications/Payment
     Recording/Loan Accounts/Clients) and redirects. New "Landing Page" card in Settings.
   - **Sidebar collapse preference upgraded to per-user.** Discovered this already existed
     (`AppLayout.tsx`, `lms.sidebarCollapsed`) but as a single shared localStorage key - one
     officer's choice silently applied to the next login on a shared machine. Suffixed the key by
     `currentAccount.id`, matching every other preference's pattern.
   - **Custom Accent Color** - `theme-provider.tsx` gained `Accent = '...' | 'custom'`, a
     `hexToHsl()` converter, and `applyCustomAccent()`/`clearCustomAccent()` which set
     `--primary`/`--ring`/`--sidebar-accent`/`--chart-1` as inline CSS variables (win over any
     stylesheet rule on the same `<html>` element - no `[data-accent='custom']` block needed).
     Clamps lightness per light/dark mode so any picked color stays legible. New "Custom" swatch +
     native color `<input>` in Settings > Theme Color.
   - Verified each piece with `tsc --noEmit` (clean throughout) and a browser console-error check
     (no login credentials available in this environment, so only the pre-login shell was
     reachable - same longstanding constraint noted across sessions).

5. **Notification Center** - the 6th and largest suggestion. Investigated first: **no notification
   concept existed anywhere** (no `Notification` model, no storage, no bell icon placeholder). User
   chose the fuller option (real persisted history, not just live derived counts) after seeing the
   tradeoff, and also asked to include "loan overdue" notifications despite no job scheduler existing
   in this codebase. Built as a proper 4-milestone backend+frontend feature, planned and confirmed
   with the user before implementation (mirrors the earlier Review Pipeline milestone approach):

   - **Milestone A (schema + domain):** new `Notification` Prisma model + `NotificationType` enum
     (`APPLICATION_SUBMITTED`, `APPLICATION_PRE_APPROVAL_READY`, `APPLICATION_DECIDED`,
     `LOAN_OVERDUE`), migration `20260717083453_create_notifications_table` applied to local dev
     Postgres. Domain entity `Notification.ts` (append-only except `markRead()`).
   - **Milestone B (use cases + API):** `ListNotificationsUseCase` (cursor-paginated + unread count),
     `MarkNotificationReadUseCase` (ownership-checked), `MarkAllNotificationsReadUseCase`,
     `PrismaNotificationRepository`, `GET/PATCH/POST /notifications*` routes (any authenticated
     user, scoped to their own `recipientUserId` from the JWT). `IUserRepository` gained
     `findByRolesAndBranch()` for recipient resolution.
   - **Milestone C (wired into real events, no fabricated ones):** `NotificationService` (plain
     service, same shape as `ProfileActivityLogService`, injected as an optional dep) is called from
     `CreateLoanApplicationUseCase` (submitted → notify MIS/Loan Operation Manager/CRM),
     `TagLoanApplicationPreApprovalUseCase` (ready for final approval → notify MIS/Loan Operation
     Manager), and `ApproveLoanApplicationUseCase`/`DeclineLoanApplicationUseCase` (decided → notify
     the original encoder). `LOAN_OVERDUE` is handled differently: no scheduler exists in this
     codebase (the `payment-reminder` module is a read-only worklist, not a send mechanism), so
     `NotificationService.syncOverdueNotifications()` runs as a **lazy sync inside
     `ListNotificationsUseCase`** - scans currently-overdue loan accounts (same live definition as
     the Dashboard's `overdueAccounts` figure) whenever *any* authenticated user opens their bell,
     with a 24h dedupe window per loan account to avoid spamming a fresh notification on every page
     load. Explicitly disclosed, known limitation: not truly real-time - an account that just became
     overdue waits until someone next opens their bell.
   - **Milestone D (frontend):** `NotificationBell.tsx` in the Topbar (unread badge, 30s poll,
     dropdown listing recent notifications, click-to-mark-read + link to the source
     application/loan where resolvable, mark-all-read). `lib/notificationPreference.ts` (per-user
     localStorage, muted types hidden from the badge/dropdown only - not deleted server-side). New
     Settings > Notifications tab with per-type mute toggles.
   - `LoanApplication` domain entity gained `applicantName`/`encodedByUserId` getters (previously
     only in the create `input`, needed by use cases that only hold an `id`).
   - Added 8 new unit tests (`tests/unit/notification/`) covering `NotificationService` (role/user
     notify, overdue sync + dedupe) and the two read use cases.
   - Verified: `tsc --noEmit` clean (backend + frontend), ESLint clean (Clean Architecture layering
     respected - no Prisma/Express imports leaked into domain/application), backend test suite
     683 passed / 16 failed (exact match to the already-documented pre-existing failure count from
     the prior session - confirmed no regression). Backend Docker image rebuilt
     (`docker compose up -d --build backend`) and the new routes verified live (401, not 404,
     against the real container).

## Current state

- Working tree has substantial uncommitted changes (Settings/Appearance overhaul across 4-5 files,
  plus the full Notification Center - a new backend module, 5 modified existing use cases, 1 new
  migration, and 6 new/modified frontend files). **Not yet committed or pushed** - the user hasn't
  asked to commit this batch yet.
- Local dev Postgres has the new `notifications` table (migrated and live) and the corrected
  `LoanAccount.activatedAt`/`createdAt` values from item 2 above (that part already committed/pushed
  separately as `07fec60`).
- Backend Docker container rebuilt and running the latest code including the Notification Center.
- Known follow-ups:
  - **No real job scheduler** - `LOAN_OVERDUE` notifications only surface via the lazy
    on-bell-open sync, not truly real-time. Worth building a real scheduler eventually and swapping
    `syncOverdueNotifications`'s call site from "inside every list request" to "on a timer."
  - **No browser click-through verification** - same longstanding constraint, no login credentials
    available in this environment. The Notification Center in particular (bell badge, dropdown,
    mark-read, Settings mute toggles) has only been verified via `tsc`, ESLint, unit tests, and
    direct route checks against the live container - a manual pass is recommended once credentials
    are available.
  - Everything else carried over from the prior session's "Known follow-ups" is still open and
    untouched this session.
