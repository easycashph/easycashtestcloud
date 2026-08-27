# Session Log: 2026-08-27 (Nomer Laptop) — full legacy re-migration, Borrower.createdAt bug (deduped with Office Server PC), stale-snapshot extraction bug fix

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

## 3. The 6 skipped role-permission grants — checked, not a real problem

Followed up on §1's flagged item. `report.view` was intentionally split into 13 granular per-report
permission codes on 2026-08-22 (`report.loan_origination.view`, `report.transactions.view`, etc.) -
`report.view` itself no longer exists, so the backup's stale grants referencing it were correctly
skipped by the restore step, not a bug. Confirmed directly against the database that all 6 affected
roles (MIS, Loan Operation Manager, CRM, Finance, Collection Officer, Accounting) already carry all
13 granular report permissions - `seed.ts`'s own `defaultRolePermissions` grants these automatically
on every fresh reset, so no report access was actually lost.

## 4. Found and fixed: the migration script was silently using a STALE MongoDB snapshot

User asked "ito ba ang na-migrate mo, 20260827_080304.zip?" (the newest one) - checking confirmed
**no**: `legacy\mongodb\extracted\` had no `20260827_080304` folder at all, and the §1 migration run
had actually read from `extracted\20260818_101701\db-easycash` (9 days stale) despite the script
printing "Gagamitin: 20260827_080304.zip".

Root cause: `Run Full Legacy Migration (Office Server PC).bat`'s extraction step is
`if exist "%TARGET_DIR%\db-easycash" if exist "%TARGET_DIR%\db-address-api" (X) else (Y)` - a classic
Windows batch gotcha where `else` binds only to the SECOND chained `if`, not the whole pair. When
the target folder doesn't exist yet at all (the normal case for a brand-new zip - `db-easycash`
doesn't exist, so the first `if` is false), the entire two-if chain is a silent no-op and NEITHER
branch runs - extraction never happens, and no error is raised either. `migrate-legacy-data.ts`'s
`legacyDbEasycashDir()` helper then transparently fell back to whichever OLDER extracted folder had
the newest modification time, with nothing in the log to flag the mismatch. The Mac counterpart
(`legacy/Run Full Legacy Migration.command`, plain bash `if [ -d A ] && [ -d B ]; then ... else ...
fi`) does not have this bug - bash's `if`/`&&` binds the `else` to the whole condition correctly.

Fixed by computing a single `NEED_EXTRACT` flag first, then branching on that alone - sidesteps the
chained-if/else binding gotcha entirely rather than trying to nest the conditions more carefully.
Also created `Run Full Legacy Migration (Nomer Laptop).bat` - an identical copy (nothing in either
script is actually machine-specific) purely so it's obvious at a glance which machine ran which
migration, matching the per-machine session-log naming already in use. Both files must be kept in
sync if either changes again.

Re-ran the full migration after the fix, confirmed via the log this time ("Dump directory:
...\extracted\20260827_080304\db-easycash") that the correct, current snapshot was used - 4,610
borrowers this time (vs. 4,607/4,632 in the earlier, stale-data runs), all 18 steps clean, 9/9 user
accounts restored again. Re-ran `backfill-legacy-borrower-created-dates.ts --apply` against the
fresh data (4,610/4,610 updated, oldest record 2009-12-25) since it's a from-scratch reset.

**This bug likely also affected past Office Server PC migration runs** - flagged for the user to
pass along, since any full re-migration there using the un-fixed `.bat` would have silently reused
whatever was already extracted instead of a genuinely newer snapshot, with no error to notice.

## 5. "Hindi ba nawala ang mga attachment/address?" — attachments fine, addresses genuinely gone, now permanently recovered

User's own follow-up caution after two full resets today, checked both:

- **Attachments**: none lost. Only 20 native (non-legacy) attachments exist at all, all
  `LOAN_APPLICATION`-owned, all covered by the existing backup/restore scripts and confirmed present
  in the DB; spot-checked the physical files on the backend container's storage volume too (which a
  Postgres reset never touches) - byte sizes match the DB rows exactly.
- **Addresses**: genuinely gone, and worse than expected. A prior session (2026-08-21/25, see
  `docs/session-logs/Office Server PC/SESSION_LOG_2026-08-14_...md` §46) had recovered **1,040**
  addresses directly from the Mambu database for borrowers SDevTech's own export never had address
  data for - but that recovery ran through a throwaway MySQL container with one-off scripts deleted
  the same turn, per this repo's usual convention. There was no permanent record of *how* to redo
  it, and `prisma migrate reset --force` doesn't care that data came from a manual recovery - it
  wipes everything.

Re-derived the whole recovery from scratch by reading the same `legacy/mambu/easycash.sql` dump
directly (no throwaway container needed - this repo's existing buffer-based mysqldump parser,
already proven by `migrate-mambu-notes.ts`, handles it fine). Confirmed via the prior session log
that the real source was never Mambu's own `address` table (only ever 14 branch rows, verified
again independently) but two `CLIENT_INFO` custom-field groups: "Present Address"
(`hm_addr_pre_unit/_brgy/_city/_zip/_full`) and a second unprefixed group
(`hm_addr_unit/_street/_brgy/_city/_zipcode`, note the genuine source typo `brngy` not `brgy`).

Wrote `backfill-mambu-customfield-addresses.ts` as a **permanent, re-runnable** script this time
(the actual fix for the underlying problem, not just a one-time patch) - conservative by the same
rule as the original recovery: only ever inserts for a borrower with zero existing `addresses` rows,
so it's naturally idempotent and safe to run again after any future reset. Dry run surfaced a scope
question: it found **4,130** recoverable addresses, not 1,040, because the original recovery was
scoped only to borrowers with an ACTIVE/ACTIVE_IN_ARREARS loan (1,106 of 1,268), while this script
checks every legacy borrower regardless of loan status. Asked the user, who chose the broader scope
("Lahat ng 4,130 - Recommended"). Applied: **4,471 of 4,610 legacy borrowers (97%) now have an
address**, up from 341 (7.4%) right after the resets.

## 6. Attachments/addresses sanity check after the resets - attachments fine, prompted the address recovery above

User asked directly whether attachments were lost from the two full resets. Checked and confirmed
none were: only 20 native (non-legacy) attachments exist at all, all `LOAN_APPLICATION`-owned, all
covered by the existing backup/restore scripts and confirmed present in the DB - spot-checked the
physical files on the backend container's storage volume too (a Postgres reset never touches it;
byte sizes matched the DB rows exactly). Addresses were a different story - see §5 above, which
this question directly prompted.

## 7. Civil Status / Gender showing blank in Edit Client Details - real bug, found and fixed

User asked to check why Civil Status, Gender, and Place of Birth were blank on a specific account
(`SL-CORP_00134`, Yna Mae Sadicon Repia) despite presumably having real data. Checked the database
directly: `gender = 'FEMALE'` and `civilStatus = 'MARRIED'` were both genuinely populated -
`placeOfBirth` was the only one actually empty (a real source-data gap, not a bug).

Root cause for the other two: every `Select` dropdown across the app (`ClientProfilePage.tsx`,
`ClientCreatePage.tsx`, `LoanApplicationDetailPage.tsx`, `LoanApplicationCreatePage.tsx`) used
Title Case option values ("Male", "Married", etc.), but legacy-migrated `Borrower` records store
these fields as uppercase (`MALE`/`FEMALE`, `SINGLE`/`MARRIED`/`WIDOWED`/`DIVORCED/SEPARATED`) -
Radix Select only shows a selection when the value exactly matches one of its `SelectItem`s, so the
field silently rendered as blank/placeholder despite real data existing underneath. Confirmed the
scale before fixing: 4,487 borrowers have a `gender` value, 3,192 have a `civilStatus` value - all
of them were affected.

Normalized every dropdown to the real uppercase values (including a two-word "Divorced/Separated"
category found in 77 records, 7 of them with a reversed word order - normalized on load rather than
left unmatched). Fixed `LoanApplicationCreatePage.tsx`'s `civilStatus === 'Married'` spouse-section
gate to match the new value, and switched its dropdown labels to render via `toProperCase()` instead
of the raw option value. Commit `44e643f`.

User then asked to check the other Edit Client Details fields for the same class of bug:
Homeownership/Status, Monthly Income, SSS, TIN, Zip Code, Nationality, Place of Birth. Checked each
against the live database and the raw SDevTech source docs:
- **Homeownership/Status**: genuinely a real bug too, but a different one - see below.
- **Monthly Income, Nationality, Place of Birth**: 100% blank across all 4,610 borrowers - confirmed
  directly against the raw SDevTech `client_accounts`/`client_income_details` source documents that
  neither concept was ever captured there at all. Not a bug, nothing recoverable.
- **SSS**: has real data for many borrowers and displays correctly (plain text input, no dropdown
  involved).
- **TIN**: has data, but a lot of it is source-side junk (150 borrowers with literal `"0"`, 38 with
  `"1111"`, 38 with `"321"`) - genuine bad data entry in SDevTech itself, not something to "fix"
  without fabricating a real value.
- **Zip Code**: 3,341 of 4,830 addresses are blank, mostly among the just-recovered Mambu addresses
  (§5) whose zip custom field wasn't always filled in Mambu either - real source sparsity, faithfully
  carried through rather than invented.

**Homeownership/Status turned out to be a second, different real bug**, caught by the user
specifically suspecting the source used a different field name ("baka Status ang nakalagay").
`Borrower.homeOwnership` is a real, actively-used field for natively-created clients (populated
from a `LoanApplication`'s own intake field, per `CreateBorrowerUseCase`) - but SDevTech's own
`client_accounts` export never captured an equivalent concept, so every legacy-migrated borrower has
it blank. The actual legacy data lives on the address record instead - `Address.ownershipStatus`
("Owned"/"Rented"/"Owned by Parents"/"Owned by Relatives"), present on 700 addresses via SDevTech's
own `addresses.status` field, and already fully wired end-to-end on the backend (domain, DTO, Zod
schema, Prisma repository) but never surfaced in this form. Fixed `ClientProfilePage.tsx` to fall
back to the address field when the Borrower field is empty, and to write both in sync on save so
neither the native-client nor the legacy-client population regresses. Also corrected the dropdown's
option values to match the real data ("Rented" not "Renting"; added the two missing "Owned by
Parents"/"Owned by Relatives" categories). Commit `44e643f`.

**Flagged, not fixed this session**: `UpdateBorrowerUseCase`'s `replaceAddresses` always replaces a
borrower's ENTIRE address list with whatever the edit form sends - and the edit form only ever
loads/sends `borrower.addresses[0]`. A borrower with 2+ addresses (not rare - this exact example
account has 2) would silently lose every address past the first the next time someone saves an edit
to their profile. Needs its own design decision (which address is "the" edited one, or expose all
of them) - out of scope for this session's fix.

## Current state / follow-ups for next session

- Full migration (correct 2026-08-27 snapshot), Borrower.createdAt fix, the local address recovery,
  and the gender/civil-status/home-ownership fixes are all live and correct on this laptop.
- **Office Server PC has already pulled ahead independently** - its own session ran the Mambu
  address recovery directly against the live database (`7bfb767`, "log full address recovery on
  Office Server PC live DB (§48)"), and also landed unrelated MIS Post pool work this same window.
  Nothing more needed there for the address recovery specifically.
- **Office Server PC still needs**: `git pull` + rebuild for today's other code fixes (the `.bat`
  extraction bug `946affd`, the Borrower.createdAt fix path via `78a4473`/`946affd`, and now the
  gender/civil-status/home-ownership fix `44e643f`). The `Borrower.createdAt` backfill script should
  also be run there directly (`backfill-legacy-borrower-created-dates.ts --apply`) if it hasn't been
  already - additive/corrective, does not require a full reset.
- **Do not run a full `prisma migrate reset --force` against the Office Server PC casually** - it's
  live/production, unlike this laptop's disposable dev copy. Advised the user to check that
  machine's own migration log for a stale "Dump directory:" first, and only consider a full
  re-migration there with explicit confirmation if it's actually affected.
- Address-list overwrite risk (multi-address borrowers silently losing addresses past the first on
  edit-save) - flagged, not yet fixed.
- Not yet done: wiring the new address-recovery script (or `migrate-mambu-notes.ts`) as an actual
  step in the "Run Full Legacy Migration" `.bat` files - deliberately left manual for now since the
  Mambu SQL dump isn't guaranteed to be present on every machine, and a missing-file error mid-batch
  would be worse than a documented manual step.
- Carried over, still untouched: `migrate-mambu-notes.ts --apply` (needs the Mambu zip on the
  Office Server PC), Google Drive Trash/credential rotation, the ₱19.3M post-maturity-penalty
  correction, accrued interest on long-defaulted accounts.
