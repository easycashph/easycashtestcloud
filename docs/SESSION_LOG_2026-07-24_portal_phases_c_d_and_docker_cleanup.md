# Session Log — 2026-07-24: Easycash Portal Phases C & D, Docker cleanup

## Context

Continuation of the same-day Easycash Portal feature session (Phases A and B — one-application-
per-account rule, edit-before-decision, and optional submission geotag — were completed earlier
in the day and are covered by the conversation this log continues from). The user gave one
instruction covering the rest of the work:

> "phase B, C and D, gawin mo ng tuloy tuloy, wag ka muna mag tanong sa akin, i trust you"

i.e. proceed through Phase C and D continuously, without further clarifying questions, using the
three scope decisions already confirmed earlier in the day:
- Geotag: device GPS, optional, never blocks submission (Phase B, already done)
- Notification triggers: Approved and Declined only, not every status change
- Client profile edit scope: contact info only (mobile numbers, email, present address) — not
  name, employment, income, or government IDs

## Phase C — Approved/Declined Notification Center

Mirrors the existing staff-facing `notification` module almost exactly, scoped to `PortalAccount`
instead of a staff `User`.

**Backend (`app/backend/src/modules/client-portal/`):**
- New `PortalNotification` Prisma model + migration `20260724030558_add_portal_notifications`
  (portal_notifications table, FK to portal_accounts, cascade delete).
- Domain entity `PortalNotification.ts`, repository port/impl, `PortalNotificationService`
  (writes the in-app bell notification unconditionally, then independently attempts email/SMS,
  each gated by the existing `portalEmailEnabled`/`portalSmsEnabled` MIS toggles — same fresh-read-
  per-call pattern as `PortalOtpSender`).
- Use cases: `ListPortalNotificationsUseCase`, `MarkPortalNotificationReadUseCase` (ownership check
  via `PortalLoanApplicationNotFoundError`, reused since it's a generic "not yours" 404 shape),
  `MarkAllPortalNotificationsReadUseCase`.
- HTTP: `GET/PATCH /portal/notifications`, `PATCH /portal/notifications/:id/read`,
  `POST /portal/notifications/mark-all-read`.
- Wired as an optional `portalNotificationService?` dep into `ApproveLoanApplicationUseCase` and
  `DeclineLoanApplicationUseCase`, firing only when `application.portalAccountId` is set (mirrors
  the existing staff `notificationService` wiring pattern in both use cases exactly).

**Frontend (`app/portal/src/`):** `NotificationBell.tsx` — bell icon with unread badge (polls every
30s), dropdown list, mark-as-read on click, mark-all-as-read. Wired into `PortalHeader`.

**Tests:** `PortalNotificationService.test.ts` (6 cases — dry-run gating, no-contact-number
skip, staff-flag isolation, missing-account no-op), `MarkPortalNotificationReadUseCase.test.ts`,
extended `ApproveLoanApplicationUseCase.test.ts` and new `DeclineLoanApplicationUseCase.test.ts`
(the latter had no prior test file) for the portal-notify branch.

**Verified live:** curl end-to-end (signup → verify → login → list/mark-read/mark-all-read,
ownership isolation between two accounts confirmed with a 404), and in the browser (bell badge
count, dropdown rendering, mark-read/mark-all-read against the real backend, DB-confirmed
persistence).

## Phase D — Client profile view/edit synced with Borrower

**The missing link:** `PortalAccount.borrowerId` and the DB column/repository method already
existed from Phase 1 wiring but nothing ever set it. Added the linkage at `CreateBorrowerUseCase`
(the "Create Client Profile" use case, `POST /borrowers`): when `input.sourceApplicationId` is
set, it looks up that `LoanApplication`'s `portalAccountId` and — if present (i.e. the application
was portal-submitted, not staff-encoded) — calls `portalAccountRepository.update(portalAccountId,
{ borrowerId })`. Both new deps (`loanApplicationRepository`, `portalAccountRepository`) are
optional on `CreateBorrowerUseCaseDeps` so the use case still works standalone in tests.

**Backend:** `GetPortalProfileUseCase` / `UpdatePortalProfileUseCase` — both resolve
`PortalAccount → Borrower` via `borrowerId`, throwing a new `PortalAccountNotLinkedError` (404)
if not yet linked. The update path delegates to the existing `UpdateBorrowerUseCase` (same write
path, same ADR-050 activity logging as staff edits), called with an input object that only ever
carries the 4 confirmed self-service fields (`mobilePhone1`, `mobilePhone2`, `email`, `addresses`)
regardless of what a caller sends — the Zod schema (`updatePortalProfileSchema`) also independently
strips anything else, verified live by attempting to smuggle a `firstName` change through the PATCH
body and confirming it was silently dropped while the accompanying `email` field still saved.
HTTP: `GET/PATCH /portal/profile`.

**Frontend:** `ProfilePage.tsx` — full profile shown read-only (name, civil status — "set by
Easycash staff" note) plus an editable contact-info form (mobile numbers, email, present address
via the existing `PortalAddressPicker`). Three states: loading / not-linked (explanatory empty
state) / ready. Linked from `PortalHeader` nav and the Dashboard's "My Profile" card.

**Tests:** `GetPortalProfileUseCase.test.ts`, `UpdatePortalProfileUseCase.test.ts`, extended
`CreateBorrowerUseCase.test.ts` with 3 cases covering the new linkage (links when portal-submitted,
skips when staff-encoded, skips when no sourceApplicationId at all).

**Verified live:** curl (not-linked → 404 `PORTAL_ACCOUNT_NOT_LINKED`; linked → correct profile;
PATCH persists to the real `borrowers`/`addresses` tables, confirmed via direct DB query) and in
the browser (not-linked empty state, then the full form after linking a test Borrower via SQL,
editing the mobile number through the actual UI, and confirming the new value landed in Postgres).

## Deployment

Both phases: backend Docker image rebuilt and redeployed (`docker compose build backend` — first
attempt hit a transient `npm install` `ECONNRESET`, retried successfully; `docker compose up -d
backend`), full backend test suite run after each phase (848 passing after Phase C, 857 after
Phase D — vitest needed `--pool=forks --poolOptions.forks.singleFork=true` to avoid an
out-of-memory crash from the default multi-worker pool in this environment). Both frontend
(`app/portal`) changes typechecked and linted clean. Committed and pushed to both the monorepo
(`easycash-lms`, commits `988da02` Phase C / `01de274` Phase D) and the standalone GitHub Pages
repo (`easycash-portal`, commits `00c19b2` / `7ccfa88`, mirrored file-by-file and pushed under the
`easycashph` identity per the established workflow — contributor list reconfirmed as `easycashph`
only after each push).

## Docker cleanup (user request, same session)

User asked to clean up Docker to free local disk space. Survey (`docker system df -v`) showed
only 2 images (`easycash-backend`, `postgres:16-alpine`) and 2 volumes (`easycash_postgres_data`,
`easycash_backend_storage`), all belonging to this project and all but one small orphaned volume
actively in use — nothing extraneous to remove. The actual disk hog was **20.91GB of build cache**
(18.58GB reclaimable) accumulated from the session's several Docker rebuilds. Ran
`docker builder prune -a -f`, freeing **18.58GB**; `docker volume prune -f` and
`docker image prune -f` found nothing further to reclaim. Confirmed both containers still running
healthy afterward (`docker ps`, `curl /health`).

## Current state / follow-up

- Portal Phases A–D are all complete, tested, and deployed. The Easycash Portal now supports:
  one-application-per-account with edit-before-decision, optional submission geotag, an in-app +
  email/SMS notification center for Approved/Declined decisions, and self-service contact-info
  editing on a linked client profile — all reading/writing the same backend entities the LMS
  itself uses, so there is no separate "portal copy" of any data to keep in sync.
- Still deferred, not acted on this session: exposing the backend publicly (Cloudflare Tunnel was
  recommended earlier) so the live GitHub Pages portal can be used by real clients — the deployed
  `VITE_API_BASE_URL` still points at `localhost:4000`. Raise this again before considering the
  portal launch-ready.
- No other known follow-up work from this session.
