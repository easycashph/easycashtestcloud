# Session Log — 2026-07-18 (Auto Email Payment Reminders)

Continues from `docs/SESSION_LOG_2026-07-18_sms_payment_reminders.md` (same day, same overall
Reminders feature, second channel).

## What was done

1. **Design discussion** - user asked about adding email collection reminders next. Recommended
   mirroring the `sms-reminder` module's architecture exactly (same 5-stage trigger schedule,
   `IEmailGateway` abstraction, own log table) rather than bolting email onto `SmsReminderLog`
   directly (different recipient field, no DLR-equivalent for plain SMTP). User confirmed they
   already have a Google Workspace mailbox to use, with a "Send As" alias configured for
   `collections@easycash.ph`, and confirmed the email content should be identical to the SMS
   templates (no separate copy).

2. **Implemented** - `app/backend/src/modules/email-reminder/`, mirroring `sms-reminder` module
   for module:
   - Schema: `EmailReminderStatus` enum (`SENT | FAILED` only - plain SMTP has no delivery-
     confirmation webhook like M360's DLR), `EmailReminderLog` model (same
     `@@unique([loanAccountId, triggerType, triggerDate])` idempotency key). Migration
     `20260718073000_add_email_reminder_logs`.
   - `IEmailReminderRepository`/`PrismaEmailReminderRepository` - same `findCandidatesDueOn`/
     `findPastDueCandidates` queries as SMS, keyed on `borrower.email` instead of `mobilePhone1`.
   - `NodemailerEmailGateway` (Google Workspace SMTP, `smtp.gmail.com:587`) - authenticates as the
     real mailbox (`SMTP_USERNAME`), sends "From" the `SMTP_FROM_ADDRESS` Send As alias.
   - `SendPaymentReminderEmailUseCase` reuses `sms-reminder`'s own `renderReminderMessage` directly
     (content is identical by user's own decision, not duplicated) - same 5-trigger orchestration.
   - `EMAIL_ENABLED` env var, same false-by-default dry-run safety and NOT-`z.coerce.boolean()`
     fix as `SMS_ENABLED`.
   - `GET /email-reminder-logs` (branch-scoped, optional `loanAccountId` filter) for visibility.
   - Frontend: `EmailReminderLogsPage.tsx` (mirrors `SmsReminderLogsPage.tsx`, no delivery-status
     column since none exists for this channel), new Reports Hub card, and
     `LoanDetailPage.tsx`'s "Email (...)" badge (previously permanently "Coming Soon") now shows
     real `EmailReminderLog` status per trigger, same pattern as the SMS badge fix earlier today.
   - `scripts/test-send-email-reminder.ts` mirrors `test-send-sms-reminder.ts` exactly (dry-run
     default, `--apply`, `--trigger=<TYPE>`, logs through the same repository/idempotency key as
     the real pipeline).
   - 4 new unit tests for `SendPaymentReminderEmailUseCase` (mirrors the SMS use-case tests).
   - Verified: `tsc --noEmit` both apps, full backend suite 709 passed / 16 known pre-existing
     failures (baseline unchanged, +4 new), frontend production build clean, Docker rebuild +
     migration status confirmed (44 total), `/email-reminder-logs` route smoke-tested (401
     unauthenticated).

3. **Real end-to-end test send, one loan only** (`SL-REG_00114`, same test loan as SMS) -
   `EMAIL_ENABLED` stayed `false` throughout, per the same standing instruction as the SMS work.
   Two real credential issues hit and resolved along the way:
   - **`SMTP_PASSWORD` started with a literal `#`** - dotenv treats an unquoted `#` as a comment
     marker, silently truncating the value to empty. Fixed by wrapping the value in double quotes
     in `.env`.
   - **Regular Google account password rejected** (`535 5.7.8 Username and Password not
     accepted`) - Gmail/Workspace SMTP requires a dedicated **App Password** (needs 2-Step
     Verification enabled first), not the normal login password. Walked the user through
     generating one at `myaccount.google.com/apppasswords` while logged in as the real mailbox
     (`sales@easycash.ph`, not the `collections@easycash.ph` Send As alias - that alias has no
     login of its own).
   - First `--apply` attempt (bad credentials) left a `FAILED` row logged for
     `(SL-REG_00114, FIVE_DAYS_BEFORE, today)`, which then blocked the retry via the idempotency
     guard - deleted that one stale test row directly (dev data, not a real send) so the retry
     with corrected credentials could log fresh.
   - Final retry succeeded - user confirmed receipt of the real email (From: `collections@
     easycash.ph`) in their own inbox.

## Current state

- `EMAIL_ENABLED` is `false` - no automated email reminders sending yet, same standing instruction
  as SMS. Only the FIVE_DAYS_BEFORE content has been real-world tested so far (mirrors the SMS
  rollout's own incremental verification) - the other 4 triggers are implemented identically but
  not yet individually test-sent for email.
- Real Google Workspace SMTP credentials are in `.env` and confirmed working.
- Visibility UI covers both channels now (Reports Hub → Operation → "SMS reminder logs" and "Email
  reminder logs"; Loan Detail page's Reminders panel shows both SMS and Email real status
  side by side per trigger).
