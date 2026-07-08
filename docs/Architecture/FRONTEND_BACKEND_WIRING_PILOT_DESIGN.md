# Frontend↔Backend Wiring Pilot — Analysis & Design

**Status:** IMPLEMENTED, 2026-07-08 — Stages 0a/0b/0c/1a/1b all built and verified the same day.
**Prepared:** 2026-07-08.
**Scope:** The first real integration between `app/frontend` (previously 100% mock data) and
`app/backend` (previously 100% unconsumed by the frontend). Per `CLAUDE.md`'s workflow, this
started as the analyze/design step; §10 below records what was actually built once approved.

## Implementation summary (2026-07-08)

All five stages landed the same day as approval, verified via `tsc`/`eslint` (both clean) and a
live manual pass against a real backend + Postgres instance (`app/backend` seeded — `npx prisma db
seed` + `bootstrap-admin.ts` — since the dev database had no branch/roles/users at all before this
pilot):
- **Real login works end-to-end**: `POST /auth/login` → real JWT → `GET /auth/me` renders the real
  signed-in user ("Test Integration — MIS") in the account menu, replacing the old mock account
  switcher entirely.
- **Nav restructure + Settings** render correctly: `CONFIGURATION` group appears in the right
  position, `Settings` page's four tabs all work, `User Profile` tab shows the real signed-in
  user's actual name/email/role pulled from `/auth/me`.
- **Payment Recording** loads real data end-to-end (`GET /loan-accounts`, `/repayment-schedule`)
  with no console errors — currently renders its correct empty state ("No unpaid installments")
  because the dev database has zero loan accounts yet (this pilot did not seed sample loan data,
  by design — populating a demo loan is separate follow-up work, not required to prove the wiring
  itself). The submit path (`POST /payments` with idempotency key, `409`/`403`/`404` handling) is
  implemented against the documented contract but not yet exercised against a live loan — flagged
  here rather than silently claimed as fully proven.
- One implementation deviation from the original interpretation of the request, corrected
  mid-design (see §8.2): Theme Color/Appearance were first assumed to stay MIS-only, then
  corrected to be personal per-user preferences per explicit instruction — both the design and the
  code reflect the corrected version.

---

## 1. Why this, and why now

Both tracks are individually solid:

- Backend: 510/510 tests passing (verified against a live Postgres instance, 2026-07-08), real
  JWT auth with refresh-token rotation and reuse detection, RBAC, branch scoping, optimistic
  concurrency, fail-closed financial audit logging, and a tested HTTP surface for the full
  application→approval→activation→payment lifecycle.
- Frontend: 20 pages, feature-complete UI/UX validated with the business, builds clean.

But they have never been connected, and the two have quietly diverged while evolving in parallel
(see §3). Every day that continues, reconciling them gets more expensive. This pilot is scoped to
be the smallest slice that proves the wiring pattern end-to-end and forces the real divergences
into the open, without trying to wire all 20 pages at once.

---

## 2. What "the next phase" actually requires — a corrected scope

The original recommendation (see `LMS_PROJECT_SUMMARY.md` §4.2) named **Payment Recording** as the
pilot screen, on the reasoning that `ProcessPaymentUseCase` and its route already exist and are
tested. That's true, but reading both codebases side by side surfaces a precondition that
recommendation didn't account for:

**Every protected backend route requires a real JWT** (`requireAuth` middleware), and role
authorization is read from that JWT's claims (`requireRole`). The frontend's current "Switch
Account" panel (`roleContext.tsx`) is a pure client-side dropdown — no username, no password, no
token, no backend call of any kind. It cannot produce a JWT the backend will accept.

**Conclusion: real login must be Stage 0 of this pilot, before Payment Recording (or any other
screen) can be wired.** This isn't optional scope creep — no request to any `requireAuth` route can
succeed without it. The design below is two stages for exactly this reason.

---

## 3. Divergences this pilot will force into the open

Reading `LoanAccountPresenter` (backend's actual JSON shape) against `MockLoanAccount` (frontend's
invented shape) surfaces four concrete gaps a real wiring pass cannot paper over:

1. **The real API returns IDs, not display strings.** `borrowerId`, `loanProductVersionId` — no
   `borrowerName`, no `productType`, no `loanCode`-as-shown-today shape assumptions. Every page
   that currently reads `loan.borrowerName` directly needs either a join (fetch borrower + product
   separately, correlate client-side) or a backend enrichment (a presenter that embeds borrower
   name) — the latter is cleaner but is itself a backend change, not just a frontend wiring change.
2. **`paymentMethod` and `collectionAgentName` don't exist in the backend domain at all.** These
   are frontend-only fields with no `LoanAccount` column, no ADR, no use case that reads or writes
   them. `LoanAccount.ts`, `ProcessPaymentUseCase.ts`, and the Prisma schema have nothing
   resembling them.
3. **Manual allocation mode has no backend equivalent.** `ProcessPaymentUseCase` always runs the
   automatic fees→penalty→interest→principal engine (`PaymentAllocationService`, ADR-009); there is
   no parameter anywhere in the use case, controller, or request schema for a staff-entered manual
   split. The current Payment Recording page's "Manual" tab is a pure client-side simulation with
   nothing on the other end to receive it.
4. **`collectionsBalance`/`accountingBalance` are real and match** (ADR-007 §3, CP11) — this one
   already lines up field-for-field between the mock and the real presenter. Good sign the naming
   discipline paid off.

None of these are blockers — they're exactly the kind of thing this pilot exists to surface early,
cheaply, on one screen, instead of discovering all twenty at once during a "big bang" wiring pass.

---

## 4. Design — Stage 0: Real Authentication

**Goal:** replace the mock "Switch Account" dropdown's *authentication* role (not necessarily its
UI) with a real `POST /auth/login` call, and make every subsequent API call carry a real,
auto-refreshing JWT.

### 4.1 API contract (already built, verified 2026-07-08)
- `POST /auth/login` — `{ email, password }` → sets an HttpOnly refresh-token cookie, returns
  `{ accessToken, user }` in the JSON body. Rate-limited (8/15min).
- `POST /auth/refresh` — reads the refresh cookie, rotates it (reuse-detection on replay), returns
  a new `accessToken`. Rate-limited (20/15min, added 2026-07-08).
- `GET /auth/me` — returns the current user from a valid access token.
- `POST /auth/logout` / `POST /auth/logout-all`.

### 4.2 Frontend changes
- New `src/lib/apiClient.ts` — a thin `fetch` wrapper (TanStack Query is already a dependency but
  unused; this pilot is the natural place to start using it) that:
  - Sends `credentials: 'include'` so the refresh cookie round-trips.
  - Attaches `Authorization: Bearer <accessToken>` from in-memory state (never `localStorage` —
    the backend already deliberately keeps the refresh token HttpOnly-cookie-only; the access
    token should follow the same "not in persistent storage" discipline).
  - On a `401` from an expired access token, transparently calls `/auth/refresh` once and retries
    the original request — the standard rotation-aware interceptor pattern this backend's
    cookie-based refresh flow expects.
- A dedicated new `LoginPage` (§6 point 1) — Username, Password, Login, a visibly present but
  non-functional "Forgot password" link.
- `roleContext.tsx` is not deleted — its *shape* (current user, role, permission booleans) stays
  useful, but its *source* changes from a hardcoded roster array to `GET /auth/me`'s response,
  and `switchAccount()` becomes a real logout+login instead of a local state swap.

### 4.3 What does NOT change in Stage 0
- No other page is touched. Every page keeps reading `MOCK_*` data exactly as today. Stage 0's only
  observable effect is that the app now requires a real login and holds a real, refreshing session
  — proving the auth plumbing works before anything financial rides on top of it.

---

## 5. Design — Stage 1: Wire Payment Recording

**Goal:** `PaymentRecordingPage` reads real loan/installment data and posts a real payment,
end-to-end, replacing its `MOCK_LOANS`/`MOCK_INSTALLMENTS` reads and its `ComingSoonButton` submit.

### 5.1 API contract (already built, verified 2026-07-08)
- `GET /loan-accounts?limit=&cursor=` — paginated list. **No status filter query param exists** —
  the "payable loans" (`ACTIVE`/`ACTIVE_IN_ARREARS`) filter has to happen client-side after
  fetching, same as today's `PAYABLE_LOANS` filter, just against real data instead of `MOCK_LOANS`.
- `GET /loan-accounts/:id` — single loan, real `LoanAccountPresenter` shape (§3.1 above).
- `GET /loan-accounts/:id/repayment-schedule` — real installments, replaces `MOCK_INSTALLMENTS`.
- `POST /loan-accounts/:id/payments` — body `{ paymentAmount, paidAt? }`, header
  `Idempotency-Key: <client-generated UUID>` (mandatory for this call — the whole reason CP13
  built idempotency support). Response: `{ loanAccount, remainder }`. Role-gated
  (`PAYMENT_RECORDING_ROLES`), branch-scoped (an officer can't post against another branch's loan).
- `GET /borrowers/:id` — needed to resolve `borrowerId` → display name for the loan picker.

### 5.2 Frontend changes
- Loan picker: fetch `GET /loan-accounts`, filter to payable statuses client-side, then resolve
  each loan's `borrowerId` via `GET /borrowers/:id` (batched/cached through TanStack Query, not
  N+1'd per render) to reconstruct the "Borrower Name — LN-0001" label the picker shows today.
- Installments table: fetch `GET /loan-accounts/:id/repayment-schedule` when a loan is selected;
  feed the real `due`/`paid` amounts into the **existing, unmodified**
  `previewCrossInstallmentAllocation()` client-side preview function — this function's job
  (showing staff a preview before they submit) is legitimate and doesn't need to change; it already
  correctly implements the same fees→penalty→interest→principal, oldest-due-first rule the backend
  enforces authoritatively.
- Submit: generate an `Idempotency-Key` (UUID) once per confirm-dialog open (not once per click —
  if the user cancels and reopens, a fresh key is correct), call `POST /loan-accounts/:id/payments`,
  handle the response:
  - `200` — show the returned `remainder`, refresh the loan/installments, log a real success state
    (replacing today's simulated `logActivity()` call with one that mirrors what actually happened
    server-side, or simply relying on the future real audit trail instead of the mock activity log
    for this screen).
  - `409` — the new `IDEMPOTENCY_KEY_IN_PROGRESS` response (H-4 fix, 2026-07-08) or a version
    conflict from optimistic concurrency — both need a clear "someone else is/just did modify this
    loan, refresh and retry" message, not a generic error toast.
  - `403` — branch/role mismatch — should be structurally unreachable if the loan picker only ever
    shows loans the current user's role/branch can act on, but must still be handled defensively.
  - `404` — loan no longer exists (deleted/never existed) — unlikely but handle gracefully.
- **Manual allocation mode stays visible but disabled**, per §6 point 2 — the tab renders, its
  inputs are inert, with a note explaining live-mode support isn't built yet.

### 5.3 What does NOT change in Stage 1
- Every other page keeps using mock data. This is deliberately one screen, not a platform-wide cut
  over.
- The Recent Activity panel on this page can keep reading `MOCK_ACTIVITY_LOGS` for now — wiring a
  real activity/audit feed is a separate, larger piece of work (the `document`/reporting layer)
  that this pilot doesn't attempt.

---

## 6. Decisions (locked in 2026-07-08)

1. **Login UX — a dedicated new Login Page** (not an extension of the "Switch Account" panel).
   Fields: **Username**, **Password**, **Login** button, **Forgot password** link (visibly present,
   explicitly non-functional for now — no backend endpoint exists for password reset, and none is
   being built in this pilot). "Username" is the field label per the approved mockup; functionally
   it's submitted as the backend's `email` field (`POST /auth/login` has no separate username
   concept — see §4.1). No placeholder/help text implying anything other than an email address is
   accepted, to avoid confusing staff.
2. **Manual allocation mode — kept visible, disabled, with an explanatory note** ("Not yet
   supported in live mode — automatic allocation only.") rather than removed outright. Communicates
   that it's planned, not abandoned.
3. **Login credentials for the pilot — the existing integration-test account**
   (`integration-test@easycash.ph`, already seeded, already exercised by
   `tests/integration/auth.test.ts`). No new seed/bootstrap work needed for Stage 0 to be
   demoable. Bootstrapping the real staff roster (Nomer Perez, etc.) is separate, later work.
4. **`paymentMethod`/`collectionAgentName`** — left as known frontend-only fields for this pilot
   (displayed read-only from the existing mock loan data, never submitted to the API). Whether they
   become a real ADR/schema addition is a decision for later, once this pilot's pattern is proven.
5. **New scope from this decision round — Configuration/Settings restructuring — UI/mock-only for
   this pilot**, explicitly deferred to real backend wiring (see §8). No `POST /users`, `PATCH
   /users/:id`, or `POST /users/:id/change-password` endpoint exists in `app/backend` today —
   building those is real, security-sensitive backend work (password hashing, uniqueness
   validation, audit logging, role-assignment rules) that deserves its own design pass, not a
   silent addition to this one. This pilot's Settings pages behave exactly like the rest of the
   still-unwired app: real-looking forms, changes held in local/mock state only.

---

## 7. Explicitly out of scope for this pilot

- Any other page (Dashboard, Loan Applications, Client Data, Loan Accounts list/detail, Reports).
- CP12 (legacy migration) — unrelated to this wiring pass.
- The five `STATUS: UNRESOLVED` calculation cases — Payment Recording's automatic allocation only
  exercises the already-implemented Declining Balance path.
- Any backend schema/domain change (e.g., adding `paymentMethod` to `LoanAccount`) — if §6 point 4
  is decided in favor of a real field, that becomes its own ADR + implementation, not silently
  folded into this pilot.
- Real backend wiring for User Profile / Security / user creation (§8) — no `POST /users`,
  `PATCH /users/:id`, or password-change endpoint exists or is being built in this pilot.

---

## 8. Design — Navigation restructure & Settings pages (part of Stage 0, mock-only)

Approved 2026-07-08. Bundled into Stage 0 because it touches the same layout/auth-adjacent surface
(the sidebar, the account/settings entry point) but is otherwise independent of the login wiring
itself — it can be built and demoed even before Stage 0's real login lands, though shipping it
alongside Stage 0 avoids two separate review passes over `AppLayout.tsx`.

### 8.1 Navigation order (`src/layouts/AppLayout.tsx`'s `NAV_GROUPS`)

New top-level group order: **Home → Loan → Collection → Configuration → Administration**
(previously Home → Loan → Collection → Administration — `Configuration` is a new group inserted
before `Administration`).

- **Configuration** (new group) — contains **Settings** (renamed from "LMS Configuration", same
  route target updated from `/admin/configuration` to e.g. `/configuration/settings`).
- **Administration** — unchanged membership (Member Details, Loan Products, Activity Logs, About),
  minus the "LMS Configuration" entry that moves to Configuration above.

### 8.2 Settings page — four sub-sections, ALL per-user (corrected 2026-07-08)

`LmsConfigurationPage.tsx` is renamed/restructured into a `SettingsPage` with an internal tabbed
layout (reusing the existing `Tabs` component already used elsewhere, e.g. Payment Recording's
Automatic/Manual toggle). **Correction from this document's first draft: Theme Color and Appearance
are personal, per-user preferences, same as User Profile and Security — none of the four tabs are
MIS-restricted.** (The first draft assumed Theme Color/Appearance stayed a shared, MIS-only,
platform-wide setting, matching today's `LmsConfigurationPage`; that assumption was wrong — corrected
per explicit instruction.)

1. **User Profile** — the signed-in user's own personal details (name, email, contact number,
   position/branch as applicable) in an editable form. Mock-only: "Save" updates local state and
   logs an activity entry, no API call (no `PATCH /users/:id` exists yet — see §6 point 5).
2. **Security** — shows the signed-in user's username (email) read-only, plus a "Change Password"
   form (current password, new password, confirm new password) applying the same `PasswordPolicy`
   minimum-length rule the backend already enforces (12 characters — `PasswordPolicy.ts`), for
   consistency even though this form doesn't call the backend yet. Mock-only, same as above.
3. **Theme Color** — the existing accent-picker content from today's `LmsConfigurationPage`, now a
   **personal preference**: each account gets its own saved accent, applied whenever that account
   is the signed-in one.
4. **Appearance** — the existing light/dark mode toggle, now also a **personal preference**, same
   storage mechanism as Theme Color.

**Every tab in Settings is accessible to every role** — each user manages only their own account
and their own appearance; there is no shared/platform-wide setting left in this page.

### 8.2.1 Per-user theme persistence (mock mechanism, since there's still no backend to persist it)

Today's `ThemeProvider` (`theme-provider.tsx`) stores one global `theme`/`accent` pair in
`localStorage` under two fixed keys (`easycash-preview-theme`, `easycash-preview-accent`) — shared
across every account, since there was previously no concept of "whose preference is this." Now that
it's per-user, the storage key needs to be scoped to the signed-in account:
- Read/write `localStorage` under a key that includes the current user's id/email (e.g.
  `easycash-preview-theme:{userId}`, `easycash-preview-accent:{userId}`) instead of one fixed key.
- On login (or, during the pre-Stage-0b transitional period, on account switch), `ThemeProvider`
  re-reads the newly-signed-in user's own stored preference (falling back to the existing
  system-preference/default logic for an account with no saved preference yet — first login looks
  the same as it does today).
- This is still entirely `localStorage`-based (mock), consistent with §6 point 5 — no backend
  persistence of theme preference is being built in this pilot either.

### 8.2.2 Remove the Topbar appearance-toggle shortcut

`AppLayout.tsx`'s `Topbar` currently renders a standalone light/dark toggle button (`Sun`/`Moon`
icon) directly next to `AccountSwitcher`, calling `toggleTheme()` independently of any Settings
page. **This button is removed.** Appearance now has exactly one control surface: the Appearance
tab inside Settings (§8.2, point 4). `useTheme()`'s `toggleTheme`/`setAccent` API is unchanged —
only this one extra entry point into it goes away.

### 8.3 User creation (Administration → Member Details)

Already MIS-only today — `MemberListPage.tsx`'s add-member dialog is gated by `canManageMembers`
(`roleContext.tsx`), which is already `currentAccount.role === 'MIS'`. No change needed here beyond
what already exists; noted because the request named it explicitly. Stays mock-only (pushes to
`MOCK_LMS_MEMBERS`), consistent with §6 point 5 — a real `POST /users` is future backend work.

### 8.4 What does NOT change

- No new backend calls anywhere in this section — every save/submit in Settings and Member
  creation continues to mutate mock state and log to `MOCK_ACTIVITY_LOGS`, exactly like the rest of
  the still-unwired app.
- `PasswordPolicy.MIN_LENGTH` is read from... actually, `PasswordPolicy.ts` lives in
  `app/backend` and is not importable by the frontend build. The Security tab's mock validation
  hard-codes the same `12`-character minimum as a frontend constant, with a comment cross-referencing
  `app/backend/src/modules/identity/domain/PasswordPolicy.ts` so the two don't silently drift once
  a real `change-password` endpoint exists.

---

## 10. Implementation order

1. **Stage 0a:** `apiClient.ts` + login call + token refresh interceptor (no UI change yet — prove
   it against `GET /auth/me` in isolation).
2. **Stage 0b:** the new Login Page (§6 point 1), `roleContext.tsx` sourced from real `/auth/me`,
   logout wired to `POST /auth/logout`.
3. **Stage 0c:** navigation restructure + Settings pages + Member creation confirmation (§8) —
   independent of 0a/0b's API work, can build/verify in parallel.
4. **Stage 1a:** loan picker + installments read-path (`GET /loan-accounts`, `/repayment-schedule`,
   `/borrowers/:id`) — no submit yet, so it's safe to demo/verify read-only before touching money.
5. **Stage 1b:** real `POST /payments` submit, idempotency key, full error-state handling, disabled
   Manual-mode note (§6 point 2).
6. Verify (lint/typecheck/build) after each stage, update `CHANGELOG.md`/`PROJECT_HANDOFF.md` at
   the end, per the project's standing documentation discipline.

All decisions in §6 and the design in §8 are approved as of 2026-07-08 — implementation may
proceed in the order above.
