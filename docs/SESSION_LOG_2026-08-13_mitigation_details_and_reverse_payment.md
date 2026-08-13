# Session Log: 2026-08-13 — Client Profile ATM/bank details, and the migrated-payment reversal gap

Continues `docs/SESSION_LOG_2026-08-12_to_2026-08-13_penalty_and_manila_time.md` (ends at commit
`c105b06`). Commit this session: `0083711`.

## 1. Read-only ATM/bank mitigation details on Client Profile (`0083711`)

User asked whether the mitigation (surrendered ATM/allotment account) details captured during loan
application review could be seen on the Client Profile page — previously they were visible **only**
on the Loan Application page. User explicitly scoped this to **Client Profile, read-only** (not the
Loan Account page) via `AskUserQuestion`; editing stays exclusively on the Loan Application page
(`SetMitigationDetailsUseCase`'s existing design is unchanged).

- New `GetBorrowerMitigationDetailsUseCase` (`src/modules/borrower/application/use-cases/`):
  resolves a borrower's mitigation data from whichever of their loan applications has it on file,
  most recent first. A borrower can link to more than one application two ways — the ORIGINAL
  application that created them (`Borrower.sourceApplicationId`) and any later ones created FROM
  them (`LoanApplication.borrowerId`, renewal flow) — both are checked.
- New route `GET /borrowers/:id/mitigation`, wired the same way as the existing
  `risk-summary` endpoint (`borrowerController.ts`/`borrowerRouter.ts`/`app.ts`).
- Frontend: new `MitigationDetailsCard` on `ClientProfilePage.tsx` — a "Bank / ATM Details" card
  that renders nothing when no application has mitigation data on file (the common case), and links
  back to the source Loan Application for edits.
- Verified against live data via the use case directly (no UI login credentials available in this
  environment): confirmed correct resolution for two real borrowers, including the one the user
  specifically checked (`TEST6NOMER TEST6NOMER TEST6NOMER`).

**Bug found and fixed mid-verification**: user reported not seeing the card at all for that client.
Root cause wasn't the code — the running Docker containers (`easycashbackend`, `lmsfrontend`) were
still on a 5-hour-old image, built before this feature existed. Rebuilt both
(`docker compose build` + `up -d`); confirmed healthy afterward. Worth remembering: a Docker
rebuild is a required step after backend/frontend changes in this deployment, not just `tsc`/tests
passing.

## 2. Reverse Payment on migrated transactions — investigated, not yet built

User asked whether a migrated (`legacyId`-bearing) payment transaction could be reversed — currently
blocked with "predates the Reverse Payment feature ... Use a manual adjustment instead."

Investigated `ReversePaymentUseCase` and the schema to find out exactly what's missing:

- **What's missing**: `PaymentAllocation` rows — the per-installment breakdown of a payment (needed
  because one payment can span multiple installments). This table was never populated for legacy
  data; CP12 migration didn't carry it over.
- **What's actually available**: `LoanTransaction.principalComponent`/`interestComponent`/
  `feesComponent`/`penaltyComponent` — aggregate (whole-transaction) totals — **are** populated for
  migrated transactions (`migrate-legacy-data.ts:776-779`, sourced from the legacy row's own
  `principal_amount`/`interest_amount`/`fees_amount`/`penalty_amount`). So the *loan-account-level*
  reversal (balances) could in principle be done correctly even for a migrated transaction.
- **The actual blocker**: without the per-installment breakdown, there's no way to know *which*
  installment(s)' `paid` amounts to roll back. Guessing (e.g. "apply to the oldest unpaid
  installment") risks the exact class of bug fixed earlier this week (`SL-CORP_00114` stuck
  "In Arrears") — a mismatch between `LoanAccount` balances and `RepaymentInstallment` state.

Three options were laid out for the user, no implementation started pending their decision:

1. Automatic best-effort allocation guess — not recommended, could silently reverse the wrong
   installment.
2. A new **Manual Adjustment tool**: MIS staff pick which installment(s) to reduce and by how much,
   required reason, audit trail — mirrors the existing `ReducePenaltyUseCase`/`AdjustFeesUseCase`
   pattern. This is what the current error message's "Use a manual adjustment instead" actually
   refers to, except **no such tool exists yet** — this would be new work.
3. Leave the restriction as-is; keep correcting these cases via one-off DB scripts per the session's
   established convention.

**Awaiting the user's decision** on whether to build option 2 (design/mockup first, per this
project's standard workflow, before any code).

## 3. Declined: pushing `.env` files to git

User asked to "push mo lahat ng env config file." Both backend `.env` files contain real secrets
(`DATABASE_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`PORTAL_JWT_SECRET`, `SMTP_PASSWORD`,
`SDEVTECH_SFTP_PASSWORD`, `SMS_REMINDER_DLR_SECRET`) and are deliberately `.gitignore`d
(`.env`/`.env.*`, `.env.example` excepted). Declined outright — pushing these would put live
credentials in GitHub history permanently, even if later deleted. Offered direct-copy (USB) or
pushing only the secret-free `.env.example` templates as alternatives; user did not pick either and
moved on, so nothing was transferred this session.

## 4. Diagnosed why the ATM/bank details feature wasn't visible on the live site

User reported the feature (§1) worked via LAN IP but not on `https://easycash-lms.pages.dev`.
Traced the full path without needing live login credentials:

- Found the actual deployed JS chunk filename via `__vite__mapDeps` in the Pages site's main
  bundle, fetched `ClientProfilePage-*.js` directly, and confirmed the feature's strings
  (`mitigation`, `ATM Details`) **were** present — so the frontend deploy was current.
- The live backend's tunnel URL (`https://*.trycloudflare.com/api/v1`) is baked into the same main
  bundle as a literal string at Cloudflare Pages' build time — extracted it and confirmed via
  `curl` that `/health` responded and `/borrowers/:id/mitigation` returned **401** (route exists,
  just unauthenticated), not 404.
- Everything checked out, yet the user still didn't see it — which surfaced the real explanation:
  **the office had, since the previous session, moved the live tunnel + database to a separate
  "main server" PC.** This session's own laptop (`Laptop-Nomer`) Docker rebuilds (§1) had no effect
  on that machine at all — two independent Docker stacks, two independent DB copies (the office
  server's was copied from this laptop earlier, before today's commits).
- Once the user pulled + rebuilt on the office server PC themselves, it started working. Saved as a
  standing memory (`project_office_server_deployment.md`) so future sessions don't re-diagnose this:
  a `git push` alone only updates the Cloudflare Pages **frontend** (auto-builds from GitHub); the
  **backend** half needs a manual `git pull` + `docker compose build/up` run **on the office server
  PC specifically**, and a tunnel restart there means updating `VITE_API_BASE_URL` in the Pages
  dashboard and retrying the deployment.

## 5. Clarified: "Delete user" in User Accounts already exists

User asked whether staff accounts could be deleted from Settings > User Accounts. No code needed —
walked through the existing feature: `MemberListPage.tsx`'s "Delete Member" button (inside Edit
Member Details) already does this, as a soft `status: 'INACTIVE'` flip via `UpdateUserUseCase`
(never a real row delete — same "preserve the audit trail" convention as `PortalAccount.DELETED`
and `Borrower` deactivation). Hidden once a user is already `INACTIVE`. User confirmed this was
sufficient ("ok na pala").

## 6. Synced with 10 commits pushed from the office server PC

While preparing to push, found this laptop's `main` was **behind `origin/main` by 10 commits** —
work done directly on the office server PC and pushed there: staff Reset Password for Portal
accounts, Portal containerization (`app/portalfrontend` Dockerfile/nginx), Bank Transfer proof-of-
payment upload, official bank account details on Ways to Pay, a live schedule preview on the
Portal, and legacy-attachment recovery scripts. Fast-forwarded cleanly (`4fb57e4..9678a15`), no
conflicts — this laptop's own two commits (`0083711`, `4fb57e4`) were already included via the
earlier push. **Confirms two machines are now both pushing to the same `origin/main`** — worth
remembering to `git pull` before starting new work here, not just before pushing.

## Verification

- `npx tsc --noEmit` clean on both apps.
- Backend use case exercised directly against the live database (two real borrowers with mitigation
  data), not just unit-level — confirms correct field values and correct source-application
  linkage.
- Docker images rebuilt and containers confirmed healthy post-deploy (on this laptop; office server
  rebuild was separately confirmed working by the user, §4).
- Live-site diagnosis (§4) done entirely via unauthenticated `curl`/bundle inspection — no
  credentials needed, no risk of touching live data.

## Open — no action taken yet

- **Reverse Payment for migrated transactions** — analysis only (§2 above). Needs the user's go-ahead
  on the Manual Adjustment tool before any design/mockup work starts.
- Carried over from the previous log, still untouched: the ₱19.3M post-maturity-penalty correction
  (user is thinking it over), and accrued interest on long-defaulted accounts (not yet examined).
- `.env` files were not transferred anywhere (§3) — still an open question if/when the user wants
  to move config to another machine.
