# Session Log: 2026-09-04 (Macbook Nomer) — CIC address PSGC fix, full DB restore from Office Server PC, verification pass

Continues `docs/session-logs/macbook-nomer/SESSION_LOG_2026-08-21_soa_penalty_breakdown_and_repo_sync.md`
(§30 series - the CIC monthly report feature build). This is a new file rather than another §
appended there since that log had already grown very large (168KB) and this session's work spans
real calendar days later (2026-09-04, not the same "day" as the rest of that log).

## 1. Caught up on 57 commits from Office Server PC / Laptop Nomer sessions

`git pull` brought in several real-world days of independent work done elsewhere while this Mac
was untouched: the event-driven notification system redesign (`NotificationScanScheduler.ts`
replacing `OverdueNotificationScheduler.ts`), a new `NotificationToaster.tsx` + portal chat sound,
Portal PWA installability, two new migrations (`20260903024621_add_event_driven_notification_types`,
`20260903052238_add_soa_accrued_interest_rate_override`), three new backfill scripts
(`backfill-remove-duplicate-other-fees.ts`, `resync-stale-migrated-loan-balances.ts`,
`resync-stale-migrated-loan-penalty.ts`), and a real fix to the CIC backfill scripts' hardcoded
`legacy/CIC` path (this machine's own folder has a trailing space, "CIC ", which the Office Server
PC fix broke - re-fixed here to try both naming conventions, see §2).

Also hit two concurrent-push conflicts mid-session (another session pushing to `main` at the same
time) - resolved each with a plain `git merge origin/main --no-edit`, no real conflicts either
time (different files touched). `npx prisma migrate deploy` + rebuilt both Docker containers,
confirmed healthy, after each pull.

## 2. Fixed the CIC backfill scripts' hardcoded folder-naming assumption

Office Server PC's own fix (`8145b1d`) hardcoded `legacy/CIC` (no trailing space) after finding
that convention on their machine - but this Mac's own copy of the folder is named `legacy/CIC `
(trailing space, established back in the original CIC investigation). Added a small
`resolveLegacyCicFile()` helper to both `backfill-cic-provider-subject-no.ts` and
`backfill-cic-provider-contract-no.ts` that tries both `CIC` and `CIC ` and uses whichever actually
exists on disk - works on either machine's local naming without hardcoding either. Verified via a
dry run (found the "CIC " folder correctly). Committed, pushed, backend rebuilt.

## 3. Ran three real-money backfill scripts pulled in from Office Server PC

User asked what these three new scripts actually do before running them - read all three, explained,
got explicit confirmation, then ran on this Mac's own local database:

- `backfill-remove-duplicate-other-fees.ts` (SDevTech's "Miscellaneous Fee" duplicated
  Notarial+Web+Insurance, double-counting them in `netProceeds`) - **8 loans fixed**, 108 left
  untouched (genuinely different discrepancy, not this bug).
- `resync-stale-migrated-loan-balances.ts` (principal/interest/fees balance drifted from the real
  repayment schedule on some migrated loans, root-caused to two SDevTech source tables disagreeing
  at migration time) - **59 loans resynced**.
- `resync-stale-migrated-loan-penalty.ts` (same root cause, penalty balance specifically) - **959
  loans resynced**.

Verified idempotent (re-running each afterward showed 0 remaining mismatches).

## 4. Found and fixed the CIC Monthly Report address PSGC-code bug (flagged, unresolved, on Laptop Nomer 2026-09-04)

User asked to look into a bug the Laptop Nomer session had flagged but not fixed: 589 of 4,834
`addresses` rows had raw PSGC (Philippine Standard Geographic Code) numbers sitting in
`barangay`/`cityMunicipality`/`province` instead of real place names - traced there to
`backfill-mambu-customfield-addresses.ts` copying Mambu's own `hm_addr_*` custom-field values
verbatim, and flagged as needing "a PSGC code->name lookup table that doesn't exist in the system
yet."

That premise was wrong - checked and found this system already HAS a fully-populated PSGC reference
(`psgc_regions`/`psgc_provinces`/`psgc_city_municipalities`/`psgc_barangays`, 17/87/1,647/42,029
rows respectively, built earlier for the address picker's autocomplete) - just never connected to
this specific cleanup. Verified directly: code `1339` -> "NCR, CITY OF MANILA, FIRST DISTRICT",
`133906` -> "SAMPALOC", `133906173` -> "Barangay 567", all real matches.

Built two backfill scripts:
- `backfill-psgc-code-addresses-to-names.ts`: for any address field that's purely numeric, look it
  up directly in the PSGC tables and replace with the real name. **507 of 631 affected rows fixed**
  in one pass; 124 left (short numeric values, not full codes - see next).
- `backfill-numbered-barangay-addresses.ts` (follow-up): the 124 remainders turned out to be Metro
  Manila's own barangay-NUMBER convention (e.g. "176") rather than a full PSGC code, with
  `cityMunicipality` already holding a real name - resolved by looking up that city's PSGC code,
  then finding its barangay literally named "Barangay {number}" (confirmed: barangay "176" under
  "Caloocan City" -> PSGC code 137501176, name "Barangay 176"). **100 of 124 fixed.**

**Final result: 607 of 631 (96%) fixed.** The remaining 24 are old Manila district names (Santa Ana,
Malate, Binondo, Paco, Intramuros) that don't map 1:1 to a modern PSGC `city_municipality` entry -
correctly left untouched rather than guessed. Both scripts committed and pushed.

## 5. Full database restore from a fresh Office Server PC dump

User asked to migrate this Mac's local database from a new dump
(`legacy/mongodb/easycash-database-2026-09-04.dump`, a real `pg_dump` custom-format export, not
MongoDB despite the folder name - same convention discovered earlier this project). Confirmed with
the user (AskUserQuestion) whether to do a full restore or the narrower borrower/loan-only restore
used previously (2026-08-30) - user chose full restore this time.

Procedure: stopped `easycashbackend` (release DB connections) -> `docker cp` the dump into the
postgres container -> `pg_restore --clean --if-exists --no-owner --no-privileges` -> confirmed
counts (4,605 borrowers, 1,809 loan accounts, 280,377 transactions) -> `npx prisma migrate deploy`
(no pending migrations - schema already matched) -> restarted `easycashbackend` -> confirmed
healthy.

**Verified none of today's local-only fixes were lost**: re-ran the PSGC address, duplicate-fees,
and balance-resync scripts post-restore and got 0/0/0 remaining - Office Server PC's own live
database already had all of them applied (confirms Office Server PC is the authoritative "main"
system per this project's own convention - local Mac fixes get superseded by, not lost by,
syncing from it). Only the penalty resync found 4 new rows (normal day-to-day drift since the
scripts were last run) - applied.

## 6. False alarm: investigated what looked like a serious CIC report bug, found it was correct by design

Post-restore, a quick sanity check on the CIC report (`getCicMonthlyReportData`) showed August 2026
at 709 contracts but only 6 individuals - alarming on its face, since every CI (contract) record
needs a matching ID (individual) record to be valid. Investigated, found a new
`isBorrowersFirstLoan()` gate in the code (added by another session, dated 2026-09-01, "corrected
twice the same day" per its own doc comment) that only creates an Individual record when a loan is
both the borrower's very first loan ever AND was released this specific reporting month.

Initially presented this to the user as a bug and asked whether to revert - the user agreed to
revert, but a closer read of the existing code comment (which explains the real reasoning:
CIC's own real July file had 1,312 CI rows but only 1 ID row, confirming an Individual only needs
submitting once ever, not every month a client has activity) revealed this was NOT a bug - it's a
deliberately correct, well-reasoned rule from a prior session, matching evidence this project had
already independently confirmed back in the original CIC investigation (§30a). Corrected course
transparently with the user mid-conversation rather than applying the wrong fix; user agreed to
keep the existing logic as-is. **No code change made** - the low individual count for a mostly-
renewal-heavy month is the CORRECT outcome, not a defect.

## Current state / follow-ups

- This Mac's database is now a full mirror of Office Server PC as of 2026-09-04 14:52 UTC, all
  migrations applied, both Docker containers rebuilt and healthy.
- All CIC-related backfill scripts (subject-no, contract-no, contract-no fallback,
  new-registrations, missing-disbursement, PSGC address x2) are pushed to `main` and safe to
  re-run (idempotent) on any machine.
- **24 addresses still need manual review** (old Manila district names not resolvable via PSGC
  lookup) - not scheduled, low priority.
- **108 loans still have an unexplained `otherFees` value** (doesn't match the
  Notarial+Web+Insurance duplicate-fee pattern) - flagged by `backfill-remove-duplicate-other-fees.ts`
  itself, not investigated this session.
- The Portal high-end design mockup from Laptop Nomer (2026-09-04,
  `https://claude.ai/code/artifact/d89050ce-e1af-45c3-b883-fa0b5ba3e1b9`) is still undecided/not
  built into the real app - not touched this session, carried over.
- CIC report scope logic (`changedThisMonth`, `isBorrowersFirstLoan`) is now believed correct and
  cross-verified in spirit with real historical data (§30's own July file analysis) - worth a full
  end-to-end re-verification against a real month's actual submission count next time one is
  available, same rigor as §30g-§30k's own back-and-forth with Office Server PC.
