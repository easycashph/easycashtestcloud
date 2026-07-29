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
- **Nothing else pending from the formula/SOA work** — both formula changes and the SOA reuse are
  committed, full backend suite green (890 tests), frontend/backend `tsc --noEmit` clean.
- **This log was extended same-day with 3 more shipped items** (all committed): a per-account
  drag-and-drop reordering toggle (`95b4d21`, §6), a real co-borrower-signing bug fix affecting
  every migrated loan (`452af06`, §7), and a new email delivery channel for the e-signature signing
  link (`452af06`, §8) — added after confirming some Smart-network numbers silently filter
  link-containing SMS. See those sections for full detail.
- **Extended again same-day with 2 more shipped items** (`60df0a0`): OTP verification now follows
  whichever channel (SMS/Email) sent the link, instead of always SMS (§9); and the Dashboard's
  Loan Portfolio Health + Recommendation cards were rearranged into a 2-column row (§10). Also
  fixed a UI gap where the "OTP will also be sent via..." hint text was missing from the
  e-signature panel despite the OTP-follows-channel logic already being implemented (§9). Pushed to
  `origin/main` (`735d00c`) after rebasing cleanly onto 2 unrelated portal commits pushed by another
  teammate in the interim.

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

## 6. Drag-and-drop card reordering toggle (Settings > Appearance)

User asked for an on/off switch for the drag-and-drop card-reordering feature (`SortableSection`,
Dashboard's `DraggableStatCard`), placed in Settings > Appearance, mockup shown and approved first.
Extended `theme-provider.tsx`'s existing per-account preference pattern (same
userId-suffixed-localStorage-key convention as theme/accent/fontSize) with a new
`dragReorderEnabled` boolean (default `true`), exposed via `useTheme()`. `SortableSection.tsx` and
`DashboardPage.tsx`'s `DraggableStatCard` both read it and pass `disabled: !dragReorderEnabled` to
dnd-kit's `useSortable()`, and don't render the grip handle at all when off — this single shared
component change covers every page that uses it (Dashboard, Client Profile, Loan Application, Loan
Account), no per-page wiring needed. Turning it off does not reset any page's already-saved card
order, just hides the handles and disables dragging. Added a new "Card Reordering" card to
`SettingsPage.tsx`'s `AppearanceTab`, styled to match the existing Dark Mode toggle exactly.
Committed as `95b4d21`.

## 7. Real bug: co-borrower e-signature lookup failed for every migrated loan

User reported "No co-borrower is linked to this loan account yet" when clicking "Send for
Co-Borrower signing" on a loan account that clearly had a co-borrower attached and visible
elsewhere in the UI. Investigated the actual DB state directly (disposable scripts, deleted after
use) rather than guessing, and found **two entirely separate, non-overlapping co-borrower linkage
mechanisms** coexisting in the live data:

1. **`LoanAccountCoBorrower`** — a per-LOAN join table. Every one of the **443** CP12-migrated
   co-borrowers in the database uses ONLY this; their `CoBorrower.borrowerId` column is `null` for
   all 443, with zero exceptions. Nothing in the current codebase's use cases ever calls
   `LoanAccount.addCoBorrower()` (confirmed via a full-codebase grep) — this join is purely a
   migration-time artifact, no live UI path creates it anymore.
2. **`CoBorrower.borrowerId`** — a direct per-BORROWER FK (ADR-015, "resolved" 2026-07-16 as the
   forward-looking design: attach a co-borrower once to a client, visible on every one of their
   loans). This is the ONLY mechanism `CreateCoBorrowerUseCase` (the real, currently-active "Add
   Co-Borrower" button on Client Profile) ever writes — it never touches the join table at all.

`CreateLoanSigningSessionUseCase`'s co-borrower lookup checked only mechanism #2
(`coBorrowerRepository.findByBorrowerId`), which is why it failed for every migrated loan (whose
co-borrower only exists via mechanism #1) — but would have equally failed the reverse way had it
only checked #1. Fixed to check the loan-level join first (specific to the exact loan), falling
back to the per-Borrower FK — verified against one real example of each case directly against the
live database (both resolved correctly afterward). Also fixed the frontend's co-borrower
default-phone-number prefill (`LoanDetailPage.tsx`) the same dual-lookup way, since it had the same
single-mechanism gap. **Business-rule note surfaced but NOT decided**: which mechanism *should* be
the standard going forward is effectively already answered by what's actually active in
production — per-Borrower (mechanism #2) is the only one with a live UI entry point today; the
loan-level join is legacy-only. No schema/architecture change was made based on this, just the bug
fix. Committed together with §8 as `452af06`.

## 8. New email delivery channel for the e-signature signing link

While testing §7's fix with a real Smart-network number, the user reported the co-borrower never
received the signing-link SMS despite the M360 API reporting success (`code: 201`) both times.
Read the M360 API documentation PDF directly (`legacy/reports/M360 SMS API and Passthru Version
3.3.4.pdf`) and found the key fact: **status 201 only means M360 accepted the request — it does
NOT confirm handset delivery**, and the DLR delivery-confirmation statuses are documented as
"Applicable to Globe Transactions only" (Smart/DITO delivery status isn't even reported back).
Tested the hypothesis directly: sent a plain-text SMS (no link) to the same Smart number via a
disposable script — **it arrived successfully**, while the earlier link-containing signing SMS to
the identical number did not. This strongly confirms Smart's network (or M360's Smart route)
silently filters/drops SMS containing URLs from an unregistered/unverified sender — a known PH
telco anti-smishing pattern, not a code bug, and not something fixable in this codebase (needs
telco/M360-side sender or link-domain registration).

User asked for a second delivery channel instead: send the signing link via **email** as an
alternative to SMS. Design confirmed via 2 quick questions: (1) a separate "Send via Email" button
next to each existing SMS button (not a toggle/dropdown), and (2) the email address is always
auto-read from the Borrower/CoBorrower profile, never staff-typed (unlike the SMS phone number
box, which is deliberately staff-editable per `CreateLoanSigningSessionUseCase`'s own 2026-07-25
doc comment). OTP verification was deliberately left as SMS-only regardless of channel — it's a
plain 6-digit code with no link, so it isn't affected by the filtering issue that motivated this
whole feature; only the initial link-send needed an alternative.

**Implementation:**
- `CreateLoanSigningSessionUseCase.execute()` gained a `channel: 'SMS' | 'EMAIL' = 'SMS'` parameter.
  For `'EMAIL'`, both the email address AND the phone number (still needed for the OTP SMS) are
  auto-resolved from the party's profile (`Borrower.email`/`mobilePhone1` or
  `CoBorrower.emailAddress`/`phoneNumber`) — new `NoEmailOnFileError`/`NoPhoneNumberOnFileError`
  domain errors if either is missing. Reused the existing `IEmailGateway`/`NodemailerEmailGateway`
  infrastructure (already used by payment-reminder emails) rather than building anything new.
- New `DryRunAwareEmailGateway` mirrors `DryRunAwareSmsGateway` exactly — checks a DB-backed
  `ReminderSettings.signingEmailEnabled` flag fresh on every send (new Prisma migration
  `20260728074152_add_signing_email_enabled`), independently toggleable from `signingSmsEnabled`.
  Threaded through the reminder-settings stack (repository/use case/presenter/controller) the same
  way `signingSmsEnabled` was in an earlier session.
- New "E-signature Email" toggle added to `SystemPage.tsx`, next to the existing "E-signature SMS"
  one.
- `createLoanSigningSessionSchema`: `phoneNumber` is now optional (only required for the `SMS`
  channel — validated inside the use case, not the schema, since the requirement is conditional);
  new `channel` enum field, default `SMS`.
- Frontend (`LoanDetailPage.tsx`): new "Send via Email" outline-variant button next to each
  existing SMS button (Borrower and Co-Borrower), disabled when no email is on file for that party
  (tooltip explains why), calling the same endpoint with `channel: 'EMAIL'` and no `phoneNumber`.
- **From-address fix (user-requested mid-implementation)**: the email initially went out from
  `collections@easycash.ph` (the existing payment-reminders "Send As" alias) — user pointed out
  this reads as a collections mailbox, not appropriate for OTP/signing emails. Added a new
  `SIGNING_SMTP_FROM_ADDRESS` env var (default `esignature@easycash.ph`), kept fully separate from
  `SMTP_FROM_ADDRESS` (payment reminders unaffected). Required setting up `esignature@easycash.ph`
  as a verified Gmail "Send As" alias on the same authenticated mailbox (`sales@easycash.ph`) first
  — walked the user through Gmail Settings > Accounts and Import > Send mail as > Add another email
  address, then through completing the verification step (the address initially showed
  "unverified", causing Gmail to silently fall back to the default `sales@easycash.ph` sender until
  verification completed). Confirmed working via a real end-to-end test send after verification.

Verified end-to-end: real test email sent to a live Gmail address, confirmed arriving from
`esignature@easycash.ph` (not `sales@` or `collections@`). 890 backend tests still passing,
`tsc --noEmit` clean on both frontend and backend. Committed together with §7 as `452af06`.

**Resolved later same day (see §9)**: the OTP-stays-SMS design from this section was superseded —
user asked for OTP to follow the link channel instead, implemented and shipped.

Also shipped after this, in the same conversation (not yet logged until now): an HTML version of
the signing email with a styled "Review and Sign Documents" button instead of a raw pasted URL
(`buildSigningEmailHtml()` in `CreateLoanSigningSessionUseCase.ts`, inline-styled per
email-client-safe conventions — no `<style>` blocks, no flexbox/grid), `IEmailGateway.send()`
gaining an optional 4th `html` param plumbed through `NodemailerEmailGateway` and
`DryRunAwareEmailGateway`; a unified `messageBody` wording (user picked "Option 3" from 4 offered
options) shared verbatim between the SMS send and the email's plain-text fallback; and a full
"high-end, advanced, sophisticated" redesign of the e-signature panel itself
(`LoanDetailPage.tsx`) — replaced the old flat phone-input-plus-two-buttons layout with a
per-party card (avatar/initials, name, a 3-button SMS/Email/Portal channel picker with Portal
disabled and badged "Soon", and one dynamic "Send via {channel}" button), then rearranged the two
party cards into a `grid sm:grid-cols-2` (side-by-side) layout per a follow-up request. All shown
as mockups and approved before implementation, per the usual workflow.

## 9. OTP verification now follows the link's delivery channel

User asked whether OTP could also get an SMS/Email toggle, "same channel as the link" — confirmed
as the better design over an independent toggle (a number that can't receive the link via SMS,
Smart's link-filtering, likely can't receive an OTP SMS either for the same reason), shown as a
mockup and approved.

**Implementation:**
- `LoanSigningSession` (domain) gained `channel: SigningLinkChannel` (`'SMS' | 'EMAIL'`, moved here
  from `CreateLoanSigningSessionUseCase.ts` where it previously lived) and an optional `email`
  field, both captured at send time (same "captured once, never re-read from the profile later"
  principle as the existing `phoneNumber` field). New Prisma migration
  `20260728155213_add_signing_session_channel_email` adds `channel` (default `"SMS"`, backward
  compatible with every pre-existing session row) and nullable `email` to
  `loan_signing_sessions`.
- `CreateLoanSigningSessionUseCase.execute()` now passes `channel`/`recipientEmail` into
  `LoanSigningSession.create()` so they're persisted on the session itself.
- `RequestSigningOtpUseCase` (called when the client opens the signing link, or taps "Resend
  code") now branches on `session.channel`: sends the OTP via `emailGateway` when `EMAIL` (and an
  email is on file), otherwise via `smsGateway` as before. Needed a new `emailGateway` dependency,
  wired in `app.ts` to the same `signingEmailGateway` (`DryRunAwareEmailGateway`) instance already
  used for the link-send — meaning the existing "E-signature Email" toggle in Settings already
  functions as the master on/off switch for OTP-by-email too; no new DB flag was needed.
- Frontend (`LoanDetailPage.tsx`): added the "OTP verification will also be sent via {SMS/email} —
  same channel as the link" hint text inside each party card (Borrower and Co-Borrower),
  dynamically reflecting the currently-selected channel — this was initially missed (only the
  backend logic was implemented in the same turn), caught when the user compared the real UI
  against the earlier-approved mockup, then added.

`tsc --noEmit` clean (frontend and backend), 890 backend tests passing. Verified via Docker
rebuild + live UI check. Committed together with §10 as `60df0a0`.

## 10. Dashboard: Loan Portfolio Health + Recommendation rearranged into a 2-column row

User showed a reference screenshot (dark-themed 3-column dashboard layout from elsewhere) and,
after iterating through several mockups, settled on: Loan Portfolio Health and Recommendation
side-by-side in one row (not the original reference's 3-column dark theme — kept our own
light/dark design system), with Recent System Activity staying full-width below, unchanged.

Iterated the mockup several rounds based on feedback: added the Good (53) and Matured (1189)
account counts inside their respective venn-diagram circles (already present in the real
`LoanPortfolioVennDiagram` component — the mockup had just omitted them, nothing to fix in code);
included the existing Good/In-Arrears/Matured explanation text and the Maintain/Protect the
margin/Resolve recommendation body text (both already existed verbatim in
`LoanPortfolioVennDiagram.tsx` and `PORTFOLIO_HEALTH_PLANS` respectively — again a mockup-fidelity
gap, not a code change); tried and then explicitly rejected a "..." menu button and a
scroll-with-chevron-to-expand treatment for the Recommendation card, settling on the full card
always fully expanded, no truncation.

**Implementation** (`DashboardPage.tsx`): wrapped the Loan Portfolio Health `Card` and the
Recommendation `Card` in a new `grid gap-4 lg:grid-cols-2` container. Since the Recommendation
card is now half-width instead of full-width, changed its inner `PORTFOLIO_HEALTH_PLANS` list from
`grid gap-3 lg:grid-cols-3` (3 cards side-by-side) to `flex flex-col gap-3` (stacked vertically) —
the only functional code change this section needed, since every other visual element the mockups
showed already existed in the real components. Recent System Activity panel (`RecentSystemActivityPanel`,
already a separate full-width component) was left untouched.

`tsc --noEmit` clean. Verified via Docker rebuild + live UI check (`Ctrl+Shift+R`). Committed
together with §9 as `60df0a0`.

## Git: push conflict with a concurrent teammate push

After committing §9/§10 (`60df0a0`), `git push` was rejected — another session had pushed 2
unrelated commits (`7ca9750`, `f11af9d` — portal applicant-profile and Privacy Policy/Terms pages)
to `origin/main` in the interim. Stashed this session's own pre-existing unrelated pending changes
(a deleted legacy `.bat` file and some untracked legacy folders/PDF — present since before this
session started, not part of this session's work) with `git stash push -u` before rebasing, per
the "never run a history-rewriting command with uncommitted changes present" safety rule. `git
pull --rebase origin main` replayed all 13 local commits cleanly on top of the 2 remote commits
with zero conflicts (different code areas entirely). Restored the stash afterward (`git stash
pop`) — unrelated changes are still sitting as pending, uncommitted local-only changes, exactly as
they were before this session, untouched. Pushed successfully as `735d00c`.

## Current state / open items for the next session

- **OTP-follows-channel**: fully implemented, migrated, tested, committed, pushed. The "E-signature
  Email" toggle in Settings is the master switch for both the email link-send AND the email OTP
  send (they share the same `DryRunAwareEmailGateway` instance) — no separate OTP toggle exists,
  by design.
- **Dashboard 2-column layout**: shipped as described in §10. The unrelated pending legacy-file
  changes (deleted `.bat`, untracked `templates-backup-preanchor/`, `legacy/Setup note only/`,
  `Loan_Penalty_Computation_Reference.pdf`) are still sitting uncommitted in the working tree as of
  this log — not part of this session's work, deliberately left alone; flag to the user next
  session if they're still there and unexplained.
- **Still open from earlier sessions, untouched today**: whether to widen Accrued Interest to
  legacy/migrated loans; sidebar brand header redesign mockups; the SOA docx template's literal
  `{PenaltyFromDate} / {PenaltyToDate}` copy (noted in the original §5 as unconditional across loan
  types).
- The full end-to-end email-link → OTP-by-email → sign flow (now that OTP follows channel) has not
  yet been walked through live by the user as of this log — worth confirming next time e-signature
  comes up.
