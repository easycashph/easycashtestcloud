# Session Log — 2026-07-28: E-signature SMS wiring, LibreOffice/LAN real-device test, penalty formula reversal, SOA reuses live penalty

## TL;DR for a fresh Claude session picking this up cold

- **Live penalty formula changed twice, both user-confirmed, both committed**: ADR-050's
  `PenaltyCalculator.calculate()` went from whole-month-gated monthly compounding →
  daily-prorated simple interest (`8f613ea`) → then, same day, no grace period + due-month-day-count
  divisor instead of a flat 30 (`8f613ea`, same commit — see §3/§4). Verified against the user's own
  Excel reference tool for a real loan (`SML-Self_00058`) — 5 of 6 installments matched to the
  centavo; the 6th's apparent mismatch was a real partial payment recorded after the Excel snapshot,
  not a formula difference. `ADR-050` §8/§9 and `CALCULATION_ENGINE_SPEC.md` §12 fully document
  both changes. **`calculateSimple()` (ADR-053, SEC MC3) was NOT touched — still whole-month, still
  has its own grace period.**
- **Statement of Account now reuses this live formula** (`0b7a4d0`) instead of maintaining its own
  parallel flat formula — for prospective loans only. Migrated loans unchanged. See §5.
- **E-signature SMS toggle finished** (`c828ef6`-era work from earlier, see prior log) and a real
  phone test was completed successfully — see §1/§2 for the LibreOffice/LAN-IP environment fixes
  that were blocking it.
- **Environment gotcha worth remembering**: this machine runs the app via **Docker Compose**
  (`app/docker/docker-compose.yml`), not a bare `npm run dev` — `localhost:5173` and
  `192.168.68.125:5173` both hit the SAME `easycash-frontend-1` container (nginx serving a
  pre-built static bundle). Restarting the container does NOT pick up source changes — the image
  must be rebuilt, and even `docker compose build` (no `--no-cache`) can silently reuse a stale
  `COPY . .` layer. Use `docker compose build --no-cache frontend && docker compose up -d
  --force-recreate frontend` when a UI change isn't showing up after a normal rebuild.
- **Nothing else pending** — both formula changes and the SOA reuse are committed, full backend
  suite green (890 tests), frontend/backend `tsc --noEmit` clean.

## Context

Continuation from `SESSION_LOG_2026-07-27_penalty_computation_deep_dive.md`, which ended with an
unresolved proposal (§6/§7 there): make the SOA's Penalty line call `resolveComputedPenalty`
directly instead of maintaining its own formula, blocked on 4 clarifying questions. This session
answered those (via "no preference" → recommended defaults) and implemented it — but first pivoted
to finish some loose ends from an even earlier e-signature-feature session, and then made a much
bigger, business-critical change: reversing ADR-050's compounding formula itself, twice, at the
user's explicit request.

## 1. E-signature SMS toggle — finished the DB-backed `signingSmsEnabled` threading

Continuing from the previous session's interrupted work: threaded `signingSmsEnabled` through
`PrismaReminderSettingsRepository`, `UpdateReminderSettingsUseCase`, `ReminderSettingsPresenter`,
and `reminderSettingsController` (validation block for the new field). Redesigned
`DryRunAwareSmsGateway` to accept an `IReminderSettingsRepository` and check `signingSmsEnabled`
fresh on every `send()` call (not a static env var), mirroring the exact precedent already
documented for `SMS_ENABLED`. Fixed `app.ts`'s broken reference to the now-removed
`env.SIGNING_SMS_ENABLED`. Added a "E-signature SMS" toggle row to `SystemPage.tsx`'s
`ReminderSettingsCard`, deliberately NOT gated by the pre-existing `REMINDER_TOGGLES_LOCKED`
constant (that lock was specifically about the payment-reminders blast, a separate earlier request).
`tsc --noEmit` clean, 771 backend tests passed. Committed as `855e1e9` (bundled with the rest of the
e-signature module — see the prior session's own log for that feature's full history).

User then asked to flip the toggle ON to test with their own phone number — did so via a small,
disposable Prisma script (deleted after use, not a committed migration script — this is a single
boolean flag flip, not a data backfill needing per-record confirmation).

## 2. Real phone test surfaced two real environment gaps — both fixed

**Gap 1 — LibreOffice not installed.** The "Send for signature" flow tries to auto-generate any
missing required documents, which shells out to LibreOffice (`soffice`) for docx→pdf conversion.
Not installed on this Windows machine at all (confirmed via `where soffice`, no
`Program Files\LibreOffice`). This is not new-code's fault — even the pre-existing Documents tab's
own "Generate" button needs LibreOffice and would have hit the same wall. Installed via
`winget install TheDocumentFoundation.LibreOffice` (26.2.4.2, verified hash). Since winget doesn't
add it to system PATH, added a new `LIBREOFFICE_BINARY_PATH` env var (`env.ts`, defaults to
`"soffice"` so Docker/production is unaffected — that image already has it on PATH) and pointed this
machine's local `.env` at the actual installed exe path. Verified end-to-end via a disposable script
mirroring `app.ts`'s real wiring — 9 documents generated successfully. Committed as `c828ef6`.

**Gap 2 — signing link used `localhost`, meaningless on a phone.** The SMS link is built from
`CORS_ORIGIN`, which defaulted to `http://localhost:5173` — opened on the user's actual phone, that
resolves to the phone itself, not the PC. Found the PC's LAN IP (`192.168.68.125`), updated backend
`.env`'s `CORS_ORIGIN` and created `app/frontend/.env`'s `VITE_API_BASE_URL` to point at it, and set
`vite.config.ts`'s dev server to `host: true` (bind all interfaces, not just loopback) — committed
as `e60f8b2`. Checked Windows Firewall (already had an inbound Allow rule for `node.exe` covering
even the Public network profile) — no firewall change needed. After this, a real SMS was sent and
the client signing page loaded correctly on the user's phone.

## 3. Penalty formula reversal #1 — compounding → daily-prorated (ADR-050 §8, user-confirmed)

User asked directly to make the live (current) ADR-050 penalty formula daily-prorated instead of
the existing whole-month-gated monthly compounding. This is the exact business-critical reversal
the prior session's log explicitly flagged as needing "an explicit, unambiguous re-confirmation" —
obtained one: confirmed the maturity-date cap (2026-07-24 rule, unaffected) stays in place, then
implemented.

Changed `PenaltyCalculator.calculate()` (`app/backend/src/shared/domain/calculation/`) from
`overdueAmount × ((1+rate)^monthsLate − 1)` (compounded monthly, whole months only) to
`overdueAmount × rate ÷ 30 × daysLate` (linear, still gated by the existing 3-day grace period at
this point). `calculateSimple()` (ADR-053, SEC MC3) untouched. Updated `ADR-050` (new §8) and
`CALCULATION_ENGINE_SPEC.md` §12 in place; rewrote the test vectors in
`PenaltyCalculator.test.ts` with recomputed expected values (verified via the actual production
formula, not hand-derived); fixed the one downstream fixture that broke
(`AccruedInterestCalculator.test.ts`'s hand-verified real-loan totals, recomputed the same way).
136 test files / 885 tests passed. Verified live against `SML-Self_00058` (a real, non-migrated
loan) via a disposable script — total dropped from the old ₱10,123.96 (compounding) to ₱8,630.30
(daily-prorated), matching the formula change's expected direction.

## 4. Penalty formula reversal #2 — align to the user's own Excel reference tool (ADR-050 §9)

User then asked me to open and analyze their own `legacy/reports/PENALTY COMPUTATION ( LMS ).xlsx`
(same real loan, `SML-Self_00058`) and explain why Live still didn't match it. No Python available
on this machine — extracted the `.xlsx` as a zip (PowerShell `Expand-Archive`) and read
`sheet1.xml`/`sharedStrings.xml` directly to reconstruct the actual cell formulas. Found 4
differences: (1) Excel has no grace period at all; (2) Excel divides by the installment's own
due-month day count (28/30/31), not a flat 30; (3) Excel uses one flat manually-entered rate, no
automatic 5%/10% tiering; (4) Excel's `TO` date was a live `TODAY()` formula with no maturity cap,
while Live already caps at the loan's maturity date.

User's decision on each, explicit and itemized:
1. **Remove the grace period from Live entirely.** An early payer needing forgiveness for those
   first few days is now a manual staff adjustment via the existing Reduce Penalty feature, not an
   automatic zero built into the formula.
2. **Change the divisor** from a flat 30 to the installment's own due-month day count, matching
   Excel's "End of the month" column.
3. **Keep Live's automatic 5%/10% tiering** — do not adopt Excel's flat manual rate.
4. **Keep Live's maturity-date cap** — confirmed correct; the Excel's own `TO` date should be
   entered as the maturity date for a matured loan (not left on `TODAY()`) to stay aligned, since
   Accrued Interest takes over after maturity, not more Penalty accrual.

Implemented in the same `PenaltyCalculator.calculate()`: removed the grace-period check, added a
`daysInMonth(dueDate)` helper, changed the divisor. Verified directly against Excel's own computed
cell values for all 6 installments of `SML-Self_00058` (TO date read as the loan's maturity date,
matching decision #4): **5 of 6 matched to the centavo exactly**. The 6th (installment #1) initially
looked off (₱2,839.86 live vs ₱3,161.29 static Excel) — traced to a real ₱600.00 partial interest
payment recorded against that installment in the live system after the Excel snapshot was taken;
recomputing Excel's own formula with the same reduced base produced ₱2,839.86 exactly too,
confirming the formulas are identical, not just close. Documented as `ADR-050` §9 and
`CALCULATION_ENGINE_SPEC.md` §12 (updated again). Rewrote `PenaltyCalculator.test.ts`'s test vectors
again (July's 31-day divisor, no-grace behavior) and
`RepaymentInstallmentPresenter.test.ts`'s 2 tests that depended on the old grace-period/compounding
assumptions — one ("is zero within grace period") flipped to "is already positive the day after due
date"; the SEC-MC3-comparison test's `>=` magnitude assumption no longer safely held (a 31-day
divisor can make the daily formula's total dip slightly below a floored whole-month simple total
over a long enough span) — rewrote it to cross-check exact values directly against both
`PenaltyCalculator` methods instead of a fragile inequality. 136 test files / 886 tests passed.
Committed together with §3 as a single commit, `8f613ea` (both formula changes shipped in one
diff since the second directly builds on the first, done in the same conversation turn-chain).

## 5. Statement of Account reuses live penalty instead of its own formula (ADR-052 addendum)

This is the item paused at the end of the previous session (§6/§7 there). User answered "no
preference" on all 4 clarifying questions, meaning: use the recommended defaults (drop the manual
`PenaltyFromDate` staff input for prospective loans, keep `PenaltyToDate` free-entry, leave migrated
loans' path unchanged, leave Accrued Interest unchanged).

**Design decided during implementation** (not previously nailed down): rather than a schema
migration to make `penaltyFromDate` nullable, the resolver now **auto-derives** it for a prospective
loan (the earliest qualifying Past Due installment's own due date) purely for display on the printed
document — the actual live computation itself doesn't use it at all (each installment supplies its
own due date automatically via `resolveComputedPenalty`). This was necessary because the SOA docx
template literally reads `{PenaltyFromDate} / {PenaltyToDate}` as a joined pair — leaving it blank
would have rendered a broken-looking `"/ July 28, 2026"`. No Prisma migration needed as a result.

**Implementation:**
- `StatementOfAccountCalculator.calculate()` gained an optional `livePenaltyContext` parameter
  (`PenaltyComputationContext`, imported from the repayment module). When present, each qualifying
  Past-Due installment's penalty is computed via `resolveComputedPenalty(installment,
  livePenaltyContext, penaltyToDate)` instead of the flat shared-range formula; `penaltyFromDate`
  is then ignored entirely. Everything else (Past Due bucketing, Current Amortization, Accrued
  Interest, Remaining Schedule) is untouched — same function, same code path, just a branch inside
  the per-installment loop.
- `StatementOfAccountMergeDataResolver.resolve()` now determines `isProspectiveLoan =
  !loanAccount.legacyId`, builds a `PenaltyComputationContext` (needs a new `loanProductRepository`
  dependency for `resolveSecMc3Coverage`, wired in `app.ts`) for prospective loans, and throws a
  `ValidationError` if a migrated loan's request omits `penaltyFromDate` (still required there —
  migrated loans have no live figure to reuse). Returns the effective `penaltyFromDate` back to the
  use case (`StatementOfAccountResolveResult.effectivePenaltyFromDate`) for persisting onto
  `GeneratedStatementOfAccount` — always a real date, auto-derived or caller-supplied.
- `GenerateStatementOfAccountInput.penaltyFromDate` made optional; schema/controller updated to
  match (`z.string().date().optional()`).
- Frontend (`LoanDetailPage.tsx`): added `legacyId` to the frontend `LoanAccount` type (was already
  returned by the backend presenter, just missing from the type). Rewrote the SOA modal's client-side
  preview (`soaPreview`) to branch the same way — daily-prorated/no-grace/due-month-divisor/
  maturity-capped for a prospective loan, unchanged flat formula for a migrated one. Rewrote the
  Penalty card's JSX: prospective loans show a "Live computed" badge, a single "As of date" field
  (no "From date"), an explanatory line ("Same figure shown on this loan's Repayment Schedule..."),
  and — added in a follow-up round after the user compared against the approved mockup — an info
  box ("Migrated loans have no live penalty on file - a manual From/To date range appears instead
  for those accounts."). Migrated loans keep the original From/To range UI unchanged.
- Added 4 new tests to `StatementOfAccountCalculator.test.ts` covering the `livePenaltyContext`
  branch (exact match against `PenaltyCalculator.calculate()`, ignores `penaltyFromDate`, respects
  the maturity cap, falls back to the flat formula when omitted). 890 backend tests passed.
- Verified against real DB records via a disposable script: prospective loan `SML-Self_00058` →
  ₱8,703.50 (matches the §4 live-figure check exactly); migrated loan → correctly throws when
  `penaltyFromDate` omitted, computes ₱13,464.37 via the unchanged flat formula when supplied.

Committed as `0b7a4d0`.

## 6. Mockup vs. real UI mismatch — traced to stale Docker image, not a code bug

After implementing, showed the user a mockup (recreated from the prior session's own description —
card layout, "Live computed" badge, single "As of date", locked Accrued Interest, migrated-loan info
box) via the `visualize` skill. User generated a real SOA and got the OLD From/To-range UI instead.
Confirmed via `grep` that the new code was genuinely present in `LoanDetailPage.tsx` (not
accidentally reverted) and `tsc --noEmit` was clean — so the gap was environmental, not a code bug.

Traced to: this machine runs the whole app via **Docker Compose**
(`app/docker/docker-compose.yml`), not a bare `vite dev` process — `netstat`/`docker ps` showed
`easycash-frontend-1` bound to port 5173 (both `localhost` and the LAN IP `192.168.68.125` hit the
same container), serving a **pre-built static bundle via nginx**, not a live dev server. A container
restart alone reuses the same stale baked-in build. Worse: a first `docker compose build frontend`
(no flag) showed every layer as `CACHED`, including `COPY . .` and `RUN npm run build` — Docker's
build cache didn't detect the source change. Had to force a real rebuild with
`docker compose build --no-cache frontend && docker compose up -d --force-recreate frontend`, which
this time genuinely ran `tsc -b && vite build` (2,629 modules, 11.5s) before the user confirmed the
UI matched. **Worth remembering for next time a UI change "isn't showing up" on this machine.**

## Current state / open items for next session

- **E-signature SMS**: fully wired, DB-backed toggle live in System tab, real phone test completed
  successfully. Toggle currently ON (user explicitly turned it on for testing) — no instruction yet
  to turn it back off; leave as-is unless asked.
- **Penalty formula (ADR-050)**: now daily-prorated, no grace period, due-month-day-count divisor,
  same 5%/10% tiering and maturity-date cap as before. Verified to match the user's own Excel
  reference tool exactly. `calculateSimple()` (ADR-053/SEC MC3) is untouched — still whole-month,
  still has its own grace period; nothing in this session asked to change that.
- **Statement of Account**: Penalty line now identical-by-construction to Live for prospective
  loans; migrated loans unchanged. Both formula work and the SOA reuse are fully committed
  (`8f613ea`, `0b7a4d0`), tested (890 backend tests), and UI-verified live in the browser.
  Nothing pending here as of this log.
  - The SOA docx template itself still literally reads `{PenaltyFromDate} / {PenaltyToDate}` — if a
    future session wants to change that copy (e.g. to something like "Penalty as of
    {PenaltyToDate}" for prospective loans specifically), that requires editing
    `templates/SOA.docx` directly (currently unconditional — same tag for every loan), not just the
    merge-data resolver. Not asked for this session; the auto-derived From-date keeps the existing
    template's phrasing intact and correct-looking.
- **Docker workflow reminder**: if a code change doesn't appear in the running app on this machine,
  check `docker ps` first — this machine runs via `docker-compose`, and `docker compose build`
  without `--no-cache` can silently skip rebuilding even when source files changed.
- Still open from earlier sessions, untouched today: whether to widen Accrued Interest to
  legacy/migrated loans, Dashboard color redesign mockups, sidebar brand header redesign mockups.
