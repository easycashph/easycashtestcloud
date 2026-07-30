# Session Log — 2026-07-18 (Reminder Settings toggle)

Continues from the same day's `SESSION_LOG_2026-07-18_sms_payment_reminders.md` /
`_email_payment_reminders.md`.

## What was done

1. **Mockup shown and approved first** (`visualize` MCP tool) - a "Payment reminders" Settings
   section with two toggle switches (SMS/Email), matching the existing SettingsPage.tsx dark-theme
   card/Switch conventions. User confirmed the design, then specified: MIS-only access, default
   OFF.

2. **Implemented a real DB-backed toggle**, replacing the previous design where `SMS_ENABLED`/
   `EMAIL_ENABLED` were static `.env` vars requiring a server restart to change:
   - New `ReminderSettings` Prisma model - a single-row table (`id` fixed to `"singleton"`) with
     `smsEnabled`/`emailEnabled` booleans (both default `false`, matching the user's explicit
     "default disabled" requirement). Migration `20260718085956_add_reminder_settings`.
   - New `reminder-settings` module (`GetReminderSettingsUseCase`/`UpdateReminderSettingsUseCase`/
     `PrismaReminderSettingsRepository`), `GET`/`PATCH /reminder-settings` - both routes gated
     `requireRole('MIS')` (user's explicit request: "MIS lang muna ang may access nito").
   - **`SendPaymentReminderSmsUseCase`/`SendPaymentReminderEmailUseCase` refactored**: the
     constructor no longer takes a static `smsEnabled`/`emailEnabled` boolean - instead takes a
     `reminderSettingsRepository` and calls `.get()` once at the START of every `execute()` run (not
     per-candidate, since a mid-run toggle isn't a real concern). This is what makes a Settings-page
     toggle actually take effect on the cron's next run without redeploying - the previous
     `.env`-only design would have required a restart every time MIS wanted to flip it.
     `.env`'s `SMS_ENABLED`/`EMAIL_ENABLED` remain defined (still validate M360/SMTP credential
     completeness at boot if set `true`) but no longer drive the actual send/dry-run decision.
   - Frontend: `SettingsPage.tsx` gained a 6th tab ("System"), shown only when
     `canManageReminderSettings` (new `roleContext.tsx` flag, MIS-only) is true - wired to the real
     `GET`/`PATCH /reminder-settings` endpoints via React Query, with an On/Off badge and Switch per
     channel.
   - Updated both `SendPaymentReminderSmsUseCase.test.ts`/`SendPaymentReminderEmailUseCase.test.ts`
     for the new constructor shape (a `buildSettingsRepository(enabled)` test helper replacing the
     plain boolean), added 2 new tests for the `reminder-settings` use cases.
   - Verified: `tsc --noEmit` both apps, full backend suite 711 passed / 16 known pre-existing
     failures (baseline unchanged, +2 new), frontend production build clean, Docker rebuild (45
     total migrations applied), `/reminder-settings` route smoke-tested (401 unauthenticated).

## Current state

- The SMS/Email reminder cron jobs now check a live, DB-backed switch each run instead of a
  boot-time `.env` value - MIS can toggle either channel from Settings → System without a server
  restart. Both default to `false` (matches the explicit "wala munang naka-enable" instruction that
  held throughout this whole day's Reminders work).
- The manual test scripts (`test-send-sms-reminder.ts`/`test-send-email-reminder.ts`) are
  unaffected by this toggle - they never read `SMS_ENABLED`/`EMAIL_ENABLED` or the new DB setting,
  by design (an explicit, one-loan, human-initiated test should always be possible regardless of
  the portfolio-wide automated switch).
- Not yet exercised via the real UI (no login credentials in this environment, the standing
  constraint noted throughout this project) - verified via direct API/DB checks only.
