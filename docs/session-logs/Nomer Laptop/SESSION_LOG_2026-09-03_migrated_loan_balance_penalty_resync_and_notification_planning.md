# Session Log: 2026-09-03 (Nomer Laptop) — migrated-loan balance/penalty resync, notification redesign planning (paused)

Continues `docs/session-logs/Nomer Laptop/SESSION_LOG_2026-09-02_sync_pull_and_migration_deploy.md`.

## 1. Synced two upstream pulls from the Office Server PC session

- `git pull` #1: fast-forwarded `3b94f1d` -> `510c550` (manual payment adjustment feature from
  the Office Server PC session): two new stale-migrated-loan resync scripts
  (`resync-stale-migrated-loan-balances.ts`, `resync-stale-migrated-loan-penalty.ts` - see §2/§3
  below), CIC report writer/repository adjustments, a CIC Monthly Report frontend tweak, and
  updates to `Update Database From SDevTech.bat`. No new migrations. Both apps typechecked clean;
  rebuilt both `easycashbackend` and `lmsfrontend` (first `write-build-info.ps1` invocation used
  wrong bash/path syntax and silently failed, caught it, re-ran correctly, rebuilt once more so
  the image bakes in the right build info - same mistake as the previous day's log, worth
  remembering to invoke that script via the PowerShell tool, not Bash's `$PWD`). Confirmed
  healthy.
- `git pull` #2 (docs-only): fast-forwarded `510c550` -> `c020c9b` - a new
  `docs/CHECKLIST_2026-09-03_sync_laptop_macbook_nomer_db.md` plus an addition to the Office
  Server PC's own session log. No code changes, no rebuild needed.

## 2. Ran `resync-stale-migrated-loan-balances.ts` (dry-run then apply)

Root cause per the script's own doc comment: `migrate-legacy-data.ts` wrote
`loan_accounts.principalBalance/interestBalance/feesBalance` once from SDevTech's account-level
snapshot, while `migrate-repayment-schedules.ts` separately wrote `repayment_schedules` from
SDevTech's schedule-level rows - the two SDevTech sources didn't always agree, so 59 loans (out of
1,285 migrated active/arrears/restructured/compromised loans) had stale cached balances. Does NOT
touch `penaltyBalance`/`penaltyDue`/`penaltyPaid` (penalty on migrated loans is tracked separately
via `AddPenaltyUseCase` postings, disconnected from `repayment_schedules`).

Dry run first (`--dry-run`), reviewed the list with the user, flagged two large outliers before
applying (SML-MAX_P1F1A/Michael Fampulme fees 28,246.54 -> 225,972.32; loan `2204`/Pedro Yulo fees
151,634.70 -> 0.00) - user proceeded anyway. Ran again without `--dry-run`: same 59 loans updated,
matching the preview exactly. 1,226 loans already matched, left untouched.

## 3. Ran `resync-stale-migrated-loan-penalty.ts` (dry-run then apply)

Same root-cause pattern as §2, but for `penaltyBalance`/`penaltyDue`/`penaltyPaid` specifically.
Per the script's doc comment, this follows a business decision the user already confirmed on the
Office Server PC session earlier today (2026-09-03): penalty on migrated loans stays FROZEN/
SDevTech-driven until SDevTech is retired (at which point migrated loans switch to live ADR-050
auto-compute, same as prospective loans) - `repayment_schedules` is the more current source to
trust in the meantime, since `AddPenaltyUseCase` already keeps it in sync going forward.

Dry run: 959 of 1,285 loans mismatched (a much larger share than the balance resync - some deltas
very large, e.g. SML-MAX_B7Y1P penalty 606,174.10 -> 438,017.49, SML-LITE_U9X8Z 573,098.28 ->
371,763.71). Flagged the scale and the largest deltas to the user before running the real apply;
user proceeded. Applied - identical 959-loan result to the dry run, 326 already matched.

Both scripts run directly against this laptop's live local database (not a repo code change) -
nothing to commit for §2/§3 themselves.

## 4. Decided to skip the "sync Laptop Nomer DB from Office Server PC dump" checklist for this machine

The new `docs/CHECKLIST_2026-09-03_sync_laptop_macbook_nomer_db.md` (pulled in §1) describes a
full `pg_restore --clean` of this laptop's database from a fresh Office Server PC dump, to bring
Laptop Nomer and Macbook Nomer to an exact replica (the dump would already contain the §78-fixed
balances). Flagged to the user that since §2/§3 above already applied the *same* fix locally via
the resync scripts, a full restore here would be redundant (same end-state, different path) -
user confirmed: **skip the checklist for Laptop Nomer**, it still applies to Macbook Nomer.

## 5. Notification system redesign - discussed, planned, explicitly paused by the user

User asked how the notification bell/dropdown works (overdue loans, export-ready). Explained the
current design after researching the code: `OverdueNotificationScheduler.ts` runs a 15-minute
`setInterval` (not a cron/BullMQ job, deliberately simple), scanning all overdue loan accounts and
notifying MIS/Loan Operation Manager/Collection Officer roles per branch, with a 24h anti-spam
dedup window (`NotificationService.syncOverdueNotifications()`). `BULK_EXPORT_READY` fires from
`ProcessBulkExportJobUseCase` on completion. Frontend `NotificationBell.tsx` polls every 30s via
TanStack Query, unread badge count, client-side-only mute preferences.

User then asked to redesign the trigger set to be event-driven, covering: Past Due/In Arrears,
Matured, Restructured, Loan Rescheduled (clarified mid-conversation - not "Adjusted" as first
said), First Amortization Due, Past Due -> Active recovery, Closed, and incoming Portal chat
messages - all events should notify everyone (same role set as today), and confirmed a Portal chat
feature already exists in the system.

Researched the codebase (via a dedicated Explore pass) before proposing a design, surfacing
important findings:
- **"Past Due" is not a stored status** - it's computed live via a raw-SQL join against
  `repayment_schedules` (`PrismaNotificationRepository.findOverdueLoanAccounts`). Nothing in the
  current codebase ever transitions a loan account's `status` column into `ACTIVE_IN_ARREARS`
  except during legacy migration - so a truly zero-polling, purely event-driven "became past due"
  trigger isn't achievable as-is; would need at minimum a coarse daily check (vs. today's 15-min
  scan) to catch date-crossing transitions.
- **"Restructured" and "Rescheduled" turned out to be the same feature** (`RestructureLoanUseCase`
  \- no separate Reschedule use case exists in the codebase). User confirmed this during the
  conversation ("Loan Rescheduled pala" - i.e. renaming, not a distinct feature).
- "Matured" and "First Amortization Due" are similarly date-computed only, no stored flag - same
  daily-check tradeoff as Past Due.
- "Closed" actually covers 4 distinct domain-method transitions (`close()`, `restructureClose()`,
  `adjustClose()`, `compromiseClose()`) plus a write-off path, each in a different use case.
- "Past Due -> Active" recovery has an existing code path (`LoanAccount.markCurrent()`, called
  from `ProcessPaymentUseCase`) but per the code's own comment it's functionally dead for
  post-migration loans (only ever fires for legacy loans that arrived pre-set as
  `ACTIVE_IN_ARREARS`) - would need redesigning around "a payment cleared every LATE installment"
  instead.
- Portal chat's `SendPortalChatMessageUseCase` already exists and has no `NotificationService`
  wired in yet - straightforward hook point.

Presented a proposed design (write-time/event-driven hooks for Restructured/Closed/Portal
chat/recovery; a once-daily check replacing the 15-min scheduler for the inherently date-based
Past Due/Matured/First Amortization Due triggers; a new Prisma migration for the additional
`NotificationType` enum values) and asked the user to confirm before implementing, per this
project's "analyze/design/explain before code" workflow.

**User said to hold off ("huwag muna, balikan ko na lang") - nothing implemented.** No code
changes for this feature in this session. Pick this up from the "Proposed approach" design already
shared with the user, next time they ask to continue.

## Current state / follow-ups for next session

- Laptop Nomer is caught up to `main` @ `c020c9b`, all migrations applied, containers healthy,
  `build-info.json` correctly reflects `c020c9b` as of the last rebuild (`510c550`) - **note:**
  the docs-only pull to `c020c9b` did not require or trigger a rebuild, so build-info still shows
  `510c550` until the next code-touching rebuild; not a problem since no code changed in between.
- Migrated-loan principal/interest/fees/penalty balances on this laptop now match
  `repayment_schedules` for all 1,285 migrated active/arrears/restructured/compromised loans
  (1,018 total records touched across both scripts today).
- The Office Server PC -> Laptop Nomer/Macbook Nomer full-DB-restore checklist
  (`docs/CHECKLIST_2026-09-03_sync_laptop_macbook_nomer_db.md`) is explicitly **skipped for Laptop
  Nomer** per user decision in §4 - still needs to be run on Macbook Nomer (not this machine's
  responsibility to track further).
- Notification system redesign is paused mid-design, not started - resume from the "Proposed
  approach" in §5 above when the user is ready.
- Carried over, still unresolved as of this entry: Office Server PC's own Facebook Link backfill,
  3-client Drive document recovery, and 6 test-account removal (from 2026-08-28's log) - not
  re-checked this session.
