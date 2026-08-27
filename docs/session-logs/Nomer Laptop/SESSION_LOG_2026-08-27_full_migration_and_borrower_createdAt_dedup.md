# Session Log: 2026-08-27 (Nomer Laptop) — full legacy re-migration, Borrower.createdAt bug (deduped with Office Server PC)

Continues `docs/session-logs/Nomer Laptop/SESSION_LOG_2026-08-26_reminder_dryrun_clients_sort_and_footer_fix.md`.

## 1. Ran the full legacy migration (Office Server PC .bat) on this laptop

User asked whether `scripts/Run Full Legacy Migration (Office Server PC).bat` could be run on this
laptop too, to refresh its local DB from the newest SDevTech snapshot. Checked the script itself
first: nothing in it is actually Office-Server-specific - every path is `%~dp0..`-relative, the
only hard dependency is a `legacy\mongodb\*.zip` backup existing locally (one did, freshly dated
this morning) and Docker running. Confirmed with the user this is a genuinely destructive local
reset (`prisma migrate reset --force`, local-only, no effect on GitHub or the remote MongoDB) before
running it, per user's explicit go-ahead ("siguraduhin mo lang na ma restore ang mga login").

First invocation attempt failed silently and harmlessly: piping `echo Y | cmd /c "...bat"` from the
Bash tool opened a fresh interactive `cmd.exe` session that printed its own banner and then choked
on `Y` as an unrecognized command - the batch file itself never ran, no DB changes happened. Fixed
by invoking the `.bat` directly (git-bash resolves it through the Windows file association) with
`echo Y |` piped straight to it, which correctly fed the confirmation prompt.

Full run completed cleanly (all 18 steps + 5 pre-reset native-data backups + 5 post-migration
restores, no `FAILED`). Verified via the log: 9/9 user accounts restored (the user's own login kept
working, the actual goal), 6/6 portal accounts, 6/6 loan applications, document templates/reminder
settings restored. Minor, non-blocking warnings: 6 users' "role class" label not found (cosmetic,
left blank) and 6 role-permission grants skipped (a `report.view` permission not found post-
migration - not investigated further this session, flagged for follow-up if it turns out to matter).

## 2. "Check din ang Date Created ng client accounts" — real bug, found and (almost) fixed twice

User asked to verify the newly-added Clients "Date Created" column actually reflected each client's
real SDevTech creation date, not just when the migration happened to run. Investigated
`migrateBorrowers()` in `migrate-legacy-data.ts`: confirmed the same bug class as the already-fixed
`LoanAccount.createdAt` (2026-07-17) - the `Borrower` upsert's `create:` block never set `createdAt`
at all, so Prisma's `@default(now())` silently recorded the migration run's own timestamp for every
migrated client.

Verified the source field (`client_accounts.creation_date`) empirically before trusting it, since
it visually resembles ambiguous `DD-MM-YYYY`: of 4,632 records, 2,034 have a SECOND number > 12
(only possible if that position is the day) and ZERO have a FIRST number > 12 - proving the field
is actually `MM-DD-YYYY`, meaning the existing naive `toDate()` (`new Date(string)`, which assumes
month-first) already parses it correctly. Wrote the fix (`createdAt: toDate(c.creation_date) ??
undefined` in the Borrower create) and a new `backfill-legacy-borrower-created-dates.ts` script
mirroring `backfill-legacy-loan-created-dates.ts`'s exact pattern, dry-ran it (4,632/4,632 to
update, spreading naturally from 2009 onward instead of clustering on the migration date), then
applied it against this laptop's local DB.

**Discovered mid-task, before pushing**: the Office Server PC session had independently found and
fixed the exact same bug at nearly the same time (`78a4473`, "Fix wrong Borrower.createdAt for
every migrated client, backfill 4,607") - same root cause, same source field, same "is it MM-DD or
DD-MM" empirical check reaching the same conclusion, same backfill-script pattern. Since theirs was
already on `main`, discarded this laptop's local duplicate edit (`git checkout --` on
`migrate-legacy-data.ts`, deleted the local duplicate backfill script) and pulled theirs instead -
clean fast-forward, no conflict. This laptop's local DB data was already correct either way (this
session's own backfill run had already applied the fix's effect before the dedup was noticed), so
no further local action was needed beyond the pull.

Committed and pushed separately: the auto-regenerated `docs/Architecture/CP12-missing-balance-
loans.md` (routine output of step 8/18 in the full migration, reflecting the newest SDevTech
snapshot - one loan's flag resolved, one loan's status changed since the last report).

## Current state / follow-ups for next session

- Full migration + Borrower.createdAt fix both live and correct on this laptop as of this session.
  Nothing further needed here for either.
- Follow-up not investigated this session: the 6 skipped role-permission grants (`report.view` not
  found post-migration) from the restore step - worth checking whether that permission code still
  exists in `seed.ts` or was renamed/removed, next time someone's touching Roles & Permissions.
- Carried over, still untouched: `migrate-mambu-notes.ts --apply` (needs the Mambu zip on the
  Office Server PC), Google Drive Trash/credential rotation, the ₱19.3M post-maturity-penalty
  correction, accrued interest on long-defaulted accounts.
