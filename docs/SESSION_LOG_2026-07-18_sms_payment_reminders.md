# Session Log — 2026-07-18 (Auto SMS Payment Reminders)

## What was done, in order

1. **Design discussion (exploratory, per CLAUDE.md's "analyze, design, validate before
   implementation")** — user asked for auto SMS payment reminders sent 5 days before an
   installment's due date. Recommended reusing the existing `payment-reminder` module's live
   "next-due-installment-per-loan" query (just filtered to an exact date instead of
   any-upcoming/overdue), and flagged the real gap: nothing in this codebase runs on a timer yet
   (`NotificationService.syncOverdueNotifications`'s own doc comment says as much) - this feature
   is the first to genuinely need one.

2. **Provider research** — searched current PH SMS gateway pricing/options (Semaphore, PhilSMS,
   international providers) and initially recommended Semaphore. User corrected this: EasyCash
   already has an active M360 (Globe-provisioned) SMS API account, the same one the legacy
   SDevTech system used - documented in
   `legacy/reports/M360 SMS API and Passthru Version 3.3.4.pdf`. Read that PDF in full and used it
   as the actual integration spec instead.

3. **Design finalized and approved**, covering: new `sms-reminder` module (Clean Architecture),
   `SmsReminderLog` table for idempotency/audit, `node-cron` for the first real scheduled job,
   `ISmsGateway` abstraction (M360 today, swappable later), a `SMS_ENABLED` dry-run safety switch,
   a `Borrower.smsRemindersEnabled` opt-out, and an M360 DLR (delivery status) webhook.

4. **Implemented:**
   - **Schema**: `Borrower.smsRemindersEnabled` (default `true`), new `SmsReminderLog` model
     (`@@unique([installmentId])` is the idempotency guard - a re-run of the daily job, or two
     overlapping runs, can never double-text the same installment). Migration
     `20260718020653_add_sms_reminder_logs`, applied to local dev Postgres.
   - **`app/backend/src/modules/sms-reminder/`**:
     - `application/ports/ISmsReminderRepository.ts`, `ISmsGateway.ts` - the two abstractions.
     - `application/reminderMessageTemplate.ts` - configurable message template
       (`SMS_REMINDER_TEMPLATE` env override, placeholders `{borrowerName}`/`{loanCode}`/
       `{amountDue}`/`{dueDate}`), per CLAUDE.md "financial rules must be configurable."
     - `application/use-cases/SendPaymentReminderSmsUseCase.ts` - the daily job body: find
       candidates due on `targetDate`, skip already-logged installments, render the message, send
       (or dry-run log if `smsEnabled=false`), log success/failure per candidate - one bad number
       never sinks the whole batch.
     - `infrastructure/PrismaSmsReminderRepository.ts` - live query mirroring
       `PrismaPaymentReminderRepository`'s "next not-fully-paid installment per loan" pattern,
       filtered to a specific Asia/Manila calendar day (a `manilaDayRange` helper: Manila is fixed
       UTC+8 year-round, no DST, so shifting the instant by the offset before reading UTC Y/M/D
       gives the correct Manila wall-clock date for free, including month/year rollover via
       `Date.UTC`'s own normalization).
     - `infrastructure/M360SmsGateway.ts` - the M360 Broadcast API client
       (`POST https://api.m360.com.ph/v3/api/broadcast`), matching the PDF's documented payload/
       response shape exactly; throws `SmsGatewayError` with M360's own message on a non-201
       response.
     - `infrastructure/smsReminderScheduler.ts` - `node-cron` wiring, `SMS_REMINDER_CRON` (default
       `0 8 * * *`, Asia/Manila). Deliberately started from `src/server.ts`, NOT from
       `src/app.ts`'s `createApp()` - that function is shared by every test file via supertest, and
       a real cron timer has no place running during the test suite.
     - `interface/http/smsReminderDlrController.ts` / `smsReminderDlrRouter.ts` - the M360 DLR
       webhook (`GET /api/v1/sms-reminders/dlr`). M360's own doc defines no auth scheme for this
       inbound call, so a `key` query-param shared secret (`SMS_REMINDER_DLR_SECRET`) is our own
       addition, checked before touching anything. Maps M360's DLR status codes (`1`→DELIVERED,
       `2`→UNDELIVERED, `16`→REJECTED, `8`/Acknowledge is a no-op since `SmsReminderLog` already
       starts at `SENT`).
   - **`shared/config/env.ts`**: 9 new env vars (`SMS_ENABLED`, `SMS_REMINDER_DAYS_BEFORE_DUE`,
     `SMS_REMINDER_CRON`, `SMS_REMINDER_TEMPLATE`, `M360_API_URL`, `M360_USERNAME`,
     `M360_PASSWORD`, `M360_SHORTCODE_MASK`, `SMS_REMINDER_DLR_SECRET`) - fail-fast at boot if
     `SMS_ENABLED=true` but the 4 M360/secret values aren't all set. **Bug caught and fixed during
     this pass**: `z.coerce.boolean()` on `SMS_ENABLED` coerced the *string* `"false"` to `true`
     (any non-empty string is JS-truthy) - would have made every environment think SMS was enabled
     the moment `.env` had `SMS_ENABLED=false` written in it. Fixed with an explicit
     `z.enum(['true','false']).transform(v => v === 'true')`.
   - **`.env`**: all 9 new vars added, `SMS_ENABLED=false` and the M360 credential fields left
     blank - safe dry-run default until the user fills in the real, active M360 username/password/
     shortcode_mask and a chosen DLR secret themselves (never asked for or handled the actual
     credential values in-chat, per this project's credential-handling rule).

5. **Verified**: `tsc --noEmit` clean, 10 new unit tests (use-case idempotency/dry-run/success/
   partial-failure paths, M360 gateway payload shape + error mapping, DLR controller secret-key
   check + status-code mapping) - full suite 703 passed / 16 known pre-existing failures (same
   baseline, +10). Spot-checked `PrismaSmsReminderRepository.findCandidatesDueOn` directly against
   the live dev DB across a 14-day window - correctly found real loans (e.g. `SML-REG_00343` at
   +0d, `BL-REG_00059` at +2d) and confirmed the Manila day-boundary math lines up (a `dueDate`
   stored as `...T16:00:00.000Z` UTC = midnight Manila the next day, landed in the expected
   bucket). Rebuilt the backend Docker image, confirmed a clean boot and the DLR webhook route
   correctly rejects an unauthenticated/wrong-key request (401).

6. **Real end-to-end test send, one loan only (user request: "huwag muna sa lahat ng loan
   account")** - rather than flipping `SMS_ENABLED=true` globally (which would let the cron fire
   for every qualifying loan portfolio-wide), built `scripts/test-send-sms-reminder.ts`: a one-off,
   single-loan-code-targeted script following this repo's existing backfill-script convention
   (dry-run by default, `--apply` required to actually send). Deliberately does NOT write to
   `SmsReminderLog` - a manual verification send shouldn't collide with or contaminate that table's
   idempotency guard for whatever installment gets picked.
   - User designated `SL-REG_00114` (their own account, NOMER PEREZ) as the test loan.
   - First `--apply` attempt failed: M360 returned `401 User Not Found` - wrong `M360_USERNAME`
     (an email address; M360 expects the client-level account username, not an email). User
     corrected it in `.env`.
   - Second attempt **succeeded** - M360 returned `transid: M36069731B9EFCE48D3241784344058`,
     user confirmed the SMS was received on the actual phone. Full pipeline (candidate lookup →
     template render → M360 API call → real delivery) verified end to end with real credentials.
   - Caught and fixed a minor script issue during this: the script called `process.exit()` at
     multiple points while a Prisma connection was still open, which raced with libuv's async
     handle cleanup on Windows (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`) -
     harmless (the SMS had already sent successfully before the crash), but noisy. Fixed by
     switching to `process.exitCode = 1; return;` throughout and `.finally(() =>
     prisma.$disconnect())` on the top-level `main()` call, matching every other script in
     `scripts/`'s existing convention exactly.

7. **Reports Hub visibility UI (user request, deferred item from the original design)** - built
   the read-only "who got texted, when, delivery status" view:
   - Backend: `ListSmsReminderLogsUseCase` + `PrismaSmsReminderRepository.listLogs()` (branch-scoped
     like every other report/dashboard query), `SmsReminderLogPresenter`, `SmsReminderLogController`/
     `Router` at `GET /api/v1/sms-reminder-logs` (`requireAuth`, unpaginated - same "thousands, not
     100,000+" volume acceptance as payment-reminder/dashboard).
   - Frontend: `smsReminderApiTypes.ts` (hand-maintained DTO mirror, same convention as every other
     report type file), `SmsReminderLogsPage.tsx` - a sortable/searchable/paginated table (mirrors
     `TransactionReportPage.tsx`/`PaymentRemindersPage.tsx`'s established pattern exactly: search
     box, status filter, click-to-expand row showing the full message/M360 transid/error, click the
     loan code to jump to that loan account). Wired into `App.tsx`
     (`/reports/sms-reminder-logs`) and `ReportsHubPage.tsx` (new card under "Operation").
   - Verified: `tsc --noEmit` both apps, full backend suite still 703/16 (unchanged - the new
     endpoint is a thin pass-through, consistent with `ListPaymentRemindersUseCase` having no
     dedicated test either), frontend production build clean, Docker rebuild + route smoke-tested
     (401 unauthenticated, confirming it's live and auth-gated). No browser click-through possible
     (no login credentials in this environment, the standing constraint noted throughout this
     project) - checked the console for load-time errors on the public login page only.

8. **Final message wording, user-provided copy** - user supplied the actual approved SMS text
   (branded header, friendly-reminder body, "already paid? disregard" closer). Replaced
   `reminderMessageTemplate.ts`'s placeholder `DEFAULT_TEMPLATE` with it verbatim, with one
   flagged and user-approved edit: the original text used an em-dash (`–`) and peso sign (`₱`),
   both outside the GSM-7 character set - including either one forces the *entire* SMS into
   UCS-2 encoding (70 chars/segment instead of 160), which would have billed every single
   reminder as 7 segments instead of 3 for a difference no recipient would actually notice.
   Swapped to a plain hyphen and "PHP" instead, user confirmed this was fine. Re-ran
   `scripts/test-send-sms-reminder.ts --loan-code=SL-REG_00114 --apply` with the final wording -
   user confirmed receipt and approved the content (`transid: M36046486D34A763A6BB81784345790`).

9. **Expanded from a single 5-days-before trigger to the full 5-stage business-confirmed schedule**
   (5/3/1 days before, Due Date, Past Due Weekly) - previously only simulated in
   `LoanDetailPage.tsx`'s `RealRemindersPanel`/`computeReminderTriggers`. Triggered by the user
   noticing that panel's stale "Coming Soon"/"no SMS/Email provider is connected" copy after the
   real M360 integration already existed - investigation found it was a completely separate,
   hardcoded, pre-2026-07-12 mock, architecturally disconnected from the real `sms-reminder`
   module. User chose to make it real rather than retire or just reword it.
   - **Schema**: added `ReminderTriggerType` enum, `triggerType`/`triggerDate` columns on
     `SmsReminderLog`, `installmentId` now nullable (PAST_DUE_WEEKLY sums across every overdue
     installment, not one), idempotency key changed from `@@unique([installmentId])` to
     `@@unique([loanAccountId, triggerType, triggerDate])` - a loan can now accumulate up to 5 rows
     (one per date-anchored trigger) plus a growing weekly tail. Migration
     `20260718052204_expand_sms_reminder_triggers`, hand-written (table was empty in every
     environment - this feature has never sent a real send outside manual tests - so no backfill
     needed; `prisma migrate dev`'s interactive confirmation prompt doesn't work in this
     non-interactive environment).
   - **Business rules confirmed with the user, one at a time** (CLAUDE.md "never invent business
     rules"): (1) content for the 4 date-anchored triggers, in the same style as the already-
     approved FIVE_DAYS_BEFORE copy, escalating urgency toward the due date; (2) for long-overdue
     accounts, `{totalAmountDue}` = sum of every overdue-and-unpaid installment's remaining
     principal+interest+fees+penalty (what's needed to become current) - explicitly NOT
     `LoanAccount`'s whole remaining balance (which would include not-yet-due future installments
     and overstate what the borrower needs to pay right now) - caught and corrected this
     distinction mid-conversation before implementing it wrong; (3) PAST_DUE_WEEKLY content
     (user-provided verbatim, same em-dash-to-hyphen fix as before: 5 segments → 2); (4) cadence -
     uncapped, every Monday (Asia/Manila), for as long as the loan has any overdue installment (no
     more "capped at 3 occurrences").
   - **Backend**: `ISmsReminderRepository`/`PrismaSmsReminderRepository` gained
     `findPastDueCandidates` (sums every overdue-unpaid installment per loan, `daysLate` from the
     OLDEST one) alongside the existing `findCandidatesDueOn`; `existsForTrigger` replaced
     `existsForInstallment`. `reminderMessageTemplate.ts` now holds one default template per
     trigger type. `SendPaymentReminderSmsUseCase.execute(now)` checks all 4 date offsets every
     run and additionally runs PAST_DUE_WEEKLY only when `now` is a Manila Monday.
     `smsReminderScheduler.ts`/`SMS_REMINDER_DAYS_BEFORE_DUE` simplified away (no single
     configurable offset anymore). `GET /sms-reminder-logs` gained an optional `loanAccountId`
     query param (for the Loan Detail page's per-loan view) and `triggerType`/`triggerDate` in its
     response.
   - **Frontend**: `SmsReminderLogsPage.tsx` gained a Trigger column + filter.
     `LoanDetailPage.tsx`'s `RealRemindersPanel` now fetches real `SmsReminderLog` rows for the
     loan and overlays real status (Sent/Delivered/Failed/etc.) on the computed date-anchored
     triggers, and lists every real Past Due send directly (no more synthetic 3-occurrence list).
   - **Manual test script** (`scripts/test-send-sms-reminder.ts`) gained a `--trigger=<TYPE>` flag
     - date-anchored triggers preview against the loan's real next-due installment, PAST_DUE_WEEKLY
     sums the loan's actual overdue installments.
   - **Verified**: `tsc --noEmit` both apps, full backend suite 705/16 (baseline restored, +2 from
     the rewritten/expanded use-case test), frontend production build clean, Docker rebuild.
     Rewrote `SendPaymentReminderSmsUseCase.test.ts` entirely for the new orchestration (4 date
     triggers checked every run, PAST_DUE_WEEKLY gated on Monday, idempotency keyed per trigger not
     per installment).
   - **Real end-to-end test sends for all 4 newly-added triggers**, one loan only
     (`SL-REG_00114`, same as before): THREE_DAYS_BEFORE (`M360561D4564B57DCA7231784353960`),
     ONE_DAY_BEFORE (`M360705A376E0AC7215F61784353979`), DUE_DATE
     (`M360A67C2CAFCC71545311784353993`), PAST_DUE_WEEKLY (`M3602BB1FEE19CBC41FF01784354026` -
     first attempt hit a transient M360 error, HTML instead of JSON, likely a brief rate-limit
     from 3 rapid-fire sends back to back; succeeded on retry after a few seconds' pause). User
     confirmed all 4 messages were received correctly on the real phone. Combined with the
     already-proven FIVE_DAYS_BEFORE, every one of the 5 trigger contents is now real-world
     verified, not just dry-run previewed.

## Current state / what's NOT done yet

- **`SMS_ENABLED` still `false`** per explicit user instruction mid-session ("manatili na disable
  muna ang sending sms hanggat hindi ko sinasabi na i enable ito") - stayed false throughout this
  entire 5-stage expansion, verified via dry-run + 6 total real manual `--apply` test sends (all to
  `SL-REG_00114`) rather than ever letting the automated cron fire.
- Real M360 credentials are in `.env`, and **all 5 trigger contents are now real-world verified**
  (FIVE_DAYS_BEFORE proven earlier in the session; THREE_DAYS_BEFORE/ONE_DAY_BEFORE/DUE_DATE/
  PAST_DUE_WEEKLY proven just now) - nothing left needing a content check before `SMS_ENABLED=true`.
- `SMS_REMINDER_DLR_SECRET` is still blank - needs a value chosen and given to M360 (as a query
  param on the DLR webhook URL) before delivery-status tracking works, independent of the
  `SMS_ENABLED` decision above.
- **Visibility UI covers all 5 triggers now** (Reports Hub → Operation → "SMS reminder logs", plus
  the Loan Detail page's own Reminders panel per-loan). Will show real automated-job rows too,
  once `SMS_ENABLED=true`.
