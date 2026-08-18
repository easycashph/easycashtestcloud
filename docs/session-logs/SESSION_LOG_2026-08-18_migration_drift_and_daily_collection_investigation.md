# Session Log: 2026-08-18 — Daily Collection Report total mismatch, and a missed-migration outage

Continues `docs/session-logs/SESSION_LOG_2026-08-14_office_server_move_and_manual_payment_adjustment.md`.
This laptop's `git` had fallen far behind `origin/main` (27 unpushed-from-here commits accumulated
on the office server across several days of independent work) — most of this session was catching
up to that state and diagnosing a real outage it caused locally.

## 1. Daily Collection Report total mismatch — investigated, root cause found upstream mid-investigation

User reported the on-screen Transaction Report total (₱609,027.03) didn't match the downloaded
`Daily Collection Report.xlsx` total for what looked like the same filters.

- Read every relevant column of the actual downloaded file (via `exceljs`, already a backend
  dependency — no new tooling needed) and confirmed none of the six numeric columns' sums matched
  the on-screen figure, ruling out "wrong column" as the explanation.
- Read the current (at the time, stale) `PrismaReportingRepository.getDailyCollectionReport` and
  found it already row-splits a payment's principal+interest / fees / penalty into up to three
  output rows (`Repayment`/`Fee Repayment`/`Penalty Repayment`) to match SDevTech's own export
  shape — a deliberate, already-committed design, not a bug, per the commit that introduced it
  (`2d13bb1`, found via `git log -p` on the file once the mismatch didn't explain itself from the
  code alone).
- `git fetch` mid-investigation surfaced **27 commits** on `origin/main` this laptop never had,
  including the actual answer: `a1fbf73 feat(reports): add Fee Charged to the Transaction Report's
  default type filter` had (very recently, from the office server) added `FEE_CHARGED` to the
  report's default type selection — an *assessment* (money owed, not money collected) that
  double-counts against its own later payment within the same date range. The code comment added
  alongside it explicitly flagged this exact risk.
- **Already fixed upstream by the time this was traced down**: `75956a3 revert(reports): remove Fee
  Charged from the Transaction Report's default type filter` had already reverted it, plus two more
  targeted fixes (`57dca11` late-loading channel-data undercount, `54739ae`/`cb61fc2` aligning
  Dashboard's "Collections This Month" with the Transaction Report). Pulling resolved the
  originally-reported mismatch without any new code needed from this session.

## 2. Explained "Collections This Month" on the Dashboard, then found the explanation was already stale

Walked through the pre-pull `PrismaDashboardRepository.getSummary` computation (`SUM(amount) WHERE
type = 'REPAYMENT' AND entryDate` in the current month) for the user. Immediately after, the same
`git fetch` above showed `54739ae`/`cb61fc2` had already changed this exact logic (to agree with
the Transaction Report's channel/type handling) — flagged to the user that the explanation just
given was now outdated rather than letting it stand uncorrected.

## 3. Pulled 27 commits, `a1fbf73..f2cb4a6`

Fast-forwarded cleanly in two steps (`a1fbf73` then `f2cb4a6`) once Docker Desktop was confirmed
running on this laptop again (it had stopped mid-session, same recurring flakiness as prior
sessions — restarted, confirmed via `docker version`, continued). Highlights from the pulled work
(all done elsewhere, not this session): Manual Payment Adjustment (`PaymentAdjustment` domain +
use case, for migrated transactions with no `PaymentAllocation` breakdown — the exact tool
`docs/session-logs/SESSION_LOG_2026-08-13_mitigation_details_and_reverse_payment.md` §2 had
proposed and left pending), Add Fee (`FeeCharge`), Delete Loan Application, per-name deterministic
avatar colors, Loan Releases Report table/column picker, a `payment_method` index for report query
performance, and six new Prisma migrations.

## 4. Live outage: Confirm Payment and Dashboard both failing, root-caused to unapplied migrations

User hit a generic "An unexpected error occurred" confirming a payment on `SML-REG_00334`, and
separately saw the Dashboard show "Could not reach the backend - showing sample data" over LAN
(`192.168.1.31:5173`). Both turned out to be the same root cause, but only after ruling out several
wrong turns — worth recording so the next occurrence goes straight to the real check:

- Confirmed the generic error came from `errorHandler.ts`'s catch-all 500 branch (not a typed
  `DomainError`), so a real unhandled exception was happening somewhere — checked whether the new
  `PossibleDuplicatePaymentError` duplicate-payment guard (`3a7c59c`, pulled this session) was the
  culprit; ruled out, since it's a proper `DomainError` subclass with a specific 409 message, not
  what the generic screen showed.
- **Wrong-machine mixup**: assumed the errors were happening on the office server (since that's
  where "the live site" usually means) and asked the user to pull backend logs there — user
  corrected this twice; the errors were actually on *this laptop*, reached via its LAN IP, not the
  office server at all.
- Checked CORS as a candidate for the Dashboard failure specifically (`curl -H "Origin:
  http://192.168.1.31:5173"` against the local backend) — ruled out, the dev-mode LAN-IP CORS
  allowance (`app.ts`'s `devOriginPattern`) worked correctly, headers came back matching.
- **Real cause, found in this laptop's own backend container logs**
  (`docker compose logs easycashbackend`): `PrismaClientKnownRequestError: The table
  "public.system_announcements" does not exist in the current database.` — this laptop's Docker
  images had been rebuilt after the 27-commit pull (§3), but the 6 new migrations that came with it
  were never applied to this laptop's own Postgres. `npx prisma migrate status` inside the
  container confirmed exactly 6 pending: `add_payment_proof_attachment_category`,
  `add_system_announcements`, `add_payment_adjustment`, `add_fee_penalty_repayment_types`,
  `add_fee_charge`, `add_payment_method_index_to_loan_transactions`.
- Fixed with `docker compose exec easycashbackend npx prisma migrate deploy` — all 6 applied
  cleanly. Verified via `curl` that the previously-500ing `/api/v1/system-announcements/active`
  endpoint now returns 401 (needs auth) instead of crashing. User confirmed both original symptoms
  (Confirm Payment, Dashboard) resolved.

**Also checked and ruled out along the way, at the office server PC** (before realizing the errors
were actually local): `docker compose exec easycashbackend npx prisma migrate status` there came
back clean ("Database schema is up to date") — the office server had already migrated correctly;
this was purely this laptop falling behind.

## Process note — added to memory, not just this log

`feedback_always_flag_docker_rebuild.md` updated: **a `git pull` that brings in new
`prisma/migrations/*` files must be followed by `docker compose exec easycashbackend npx prisma
migrate status` right after rebuilding, on whichever machine the pull happened on — not just
mentioned as something the user could do.** This exact gap (rebuild without checking migrations)
caused the §4 outage and cost several turns chasing CORS/wrong-machine/duplicate-guard theories
before the real cause was checked directly in the logs.

## Verification

- Every diagnostic step in §1/§2/§4 was read-only (log reads, `curl` probes, `git log -p`,
  `prisma migrate status`) until the actual fix (`migrate deploy`) — no code changed this session.
- Fix verified two ways: the previously-crashing endpoint's status code changed from 500 to the
  expected 401, and the user independently confirmed both original symptoms gone in the real UI.

## Open

- Nothing new opened this session. Carried over from prior logs, still untouched: the ₱19.3M
  post-maturity-penalty correction, accrued interest on long-defaulted accounts, and the Named
  Tunnel domain purchase decision.
