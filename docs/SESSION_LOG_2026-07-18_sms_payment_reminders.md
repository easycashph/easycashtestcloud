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

## Current state / what's NOT done yet

- **Real M360 credentials are now in `.env` and confirmed working** (test SMS successfully
  delivered to a real phone via `scripts/test-send-sms-reminder.ts --apply`). `SMS_ENABLED` itself
  is still `false`, though - the automated daily cron has NOT been turned on yet, only the manual
  single-loan test path has been proven. Turning on `SMS_ENABLED=true` is a separate decision (it
  affects the whole portfolio, not one test loan) - wait for explicit user go-ahead before doing
  that. User also mentioned still tuning the SMS message wording before going live.
- `SMS_REMINDER_DLR_SECRET` is still blank - needs a value chosen and given to M360 (as a query
  param on the DLR webhook URL) before delivery-status tracking works, independent of the
  `SMS_ENABLED` decision above.
- **Visibility UI now live** (Reports Hub → Operation → "SMS reminder logs") - shows every logged
  reminder attempt, including manual test sends. Will show real automated-job rows too, once
  `SMS_ENABLED=true`.
