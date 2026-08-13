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

## 7. Built: Cloudflare Tunnel auto-update script (`a23ad66`..`3ef860b`)

Following §4's diagnosis, asked for an opinion on the office-server-PC-as-live-deployment setup.
Flagged real risks honestly rather than just validating it: `trycloudflare.com` quick tunnels
aren't meant for production (URL changes every restart, no SLA), single point of failure with no
confirmed backup schedule on that PC, and unclear physical/network security posture. Recommended a
Cloudflare **Named Tunnel** as the low-effort fix (permanent URL) with self-hosted VPS/cloud as the
real long-term answer per this project's own CLAUDE.md deployment philosophy.

User wants the Named Tunnel eventually but has **no domain yet** — a Named Tunnel needs one (DNS
CNAME under a zone Cloudflare manages), so there's no way around that requirement. Chose the
stopgap instead: keep the quick tunnel, but automate the "copy URL into Pages dashboard, retry
deployment" steps that `Start Cloudflare Tunnel.bat` currently requires by hand.

Built `Start Cloudflare Tunnel (Auto-Update).ps1` (+ a `.bat` double-click wrapper, added on
request so the office doesn't need to open PowerShell manually each time): starts `cloudflared`,
parses the new URL from its own output, then calls the Cloudflare API to PATCH the Pages project's
`VITE_API_BASE_URL` env var and retry the latest deployment (a full rebuild is required — Vite
bakes `VITE_*` vars in at build time, so just re-pointing DNS/redeploying the old artifact wouldn't
pick up the change). The API token is least-privilege (Account → Cloudflare Pages → Edit only,
scoped to one account — walked the user through trimming Cloudflare's much broader default
template) and lives only in `local/tunnel-autoupdate.env` (gitignored, auto-templated on first
run), never committed.

**Live-tested and debugged interactively with the user on the office server PC** (three real bugs
found this way, not caught by local syntax checks since I have no way to hit the real Cloudflare
API from this laptop):
1. `Start-Process` rejected passing the same path to `-RedirectStandardOutput` and
   `-RedirectStandardError` — split into two separate log files (`c18a196`).
2. **The user's first-generated API token got exposed in a screenshot shared in chat.** Verified it
   directly against `https://api.cloudflare.com/client/v4/user/tokens/verify` (returned "Invalid API
   Token" — it appears the copy was incomplete, so this specific token was never actually live) and
   had the user revoke it and generate a replacement, this time copying via Cloudflare's own Copy
   button and not sharing the value in chat again.
3. Round-tripping the full `deployment_configs.production` object from a GET back into the PATCH
   body pulled in read-only/computed fields Cloudflare rejected with a generic 400 — narrowed the
   PATCH body to just `env_vars` (merging existing vars in client-side, since PATCH replaces
   `env_vars` wholesale rather than per-key) and added proper Cloudflare error-body surfacing so any
   future failure is diagnosable without another round of guessing (`54616e9`).

**Confirmed working end-to-end**: ran clean on the office server PC, and verified independently
from this laptop (no login needed) that the new tunnel URL (`achievements-constitute-
consolidation-disks.trycloudflare.com`) was baked into the freshly-deployed Pages bundle.

Also clarified for the user afterward: this removes the *manual dashboard editing* step, not the
need to *re-run the script* — it doesn't watch for tunnel restarts in the background, and won't
survive a PC reboot on its own unless a Scheduled Task is added later (offered, not yet built).

## 8. Synced again mid-task with 3 more office-server commits

While committing the script fixes, `git push` was rejected a second time (non-fast-forward) —
`94d37c2`/`ffced06` (System Announcement popups for LMS/Portal, a Personal Loan eligibility note)
plus their merge commit had landed on `origin/main` from the office server in the meantime. Merged
cleanly (`git pull --no-edit`), no conflicts, then pushed. Reinforces §6's note from earlier this
session: pull before every push now that two machines write to the same `main`.

## Verification

- `npx tsc --noEmit` clean on both apps.
- Backend use case exercised directly against the live database (two real borrowers with mitigation
  data), not just unit-level — confirms correct field values and correct source-application
  linkage.
- Docker images rebuilt and containers confirmed healthy post-deploy (on this laptop; office server
  rebuild was separately confirmed working by the user, §4).
- Live-site diagnosis (§4) and the auto-update script's end-to-end verification (§7) both done via
  unauthenticated `curl`/bundle inspection from this laptop — no live credentials needed on this
  end, no risk of touching live data.
- The `.ps1`/`.bat` scripts were syntax-checked locally (`PSParser::Tokenize`) before each push, but
  their actual Cloudflare API behavior could only be verified live, on the office server PC, with
  the user relaying output — three real bugs only surfaced that way (§7).

## Open — no action taken yet

- **Reverse Payment for migrated transactions** — analysis only (§2 above). Needs the user's go-ahead
  on the Manual Adjustment tool before any design/mockup work starts.
- Carried over from the previous log, still untouched: the ₱19.3M post-maturity-penalty correction
  (user is thinking it over), and accrued interest on long-defaulted accounts (not yet examined).
- **A Named Tunnel is still the right long-term fix** (§7) — blocked purely on the office acquiring
  a domain. The auto-update script is a stopgap, not a replacement for that.
- The exposed-then-revoked API token (§7) — worth double-checking later that it's actually gone
  from the Cloudflare dashboard's token list, not just replaced.
- Auto-starting the tunnel on the office server PC's boot (Scheduled Task) was mentioned as a
  follow-up but not requested yet.
- `.env` files were not transferred anywhere (§3) — still an open question if/when the user wants
  to move config to another machine.
