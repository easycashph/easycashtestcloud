# Migration Ledger

Tracks which one-off data-fix scripts (`app/backend/scripts/`) have been run against **which
machine's local database**. These scripts are not Prisma migrations (see
`docs/DEVICE_SYNC_GUIDE.md` §3) — `prisma migrate deploy` does not run them, and `git pull` does
not either. Nothing here applies itself; every row below is a manual action someone took.

**Before re-running any script, run the automated check instead of guessing:**

```bash
cd app/backend
npx tsx scripts/check-migration-status.ts
```

It reports PASS / ACTION NEEDED for every script below, read-only, against whatever database
you're currently pointed at. Update this ledger by hand after you run a script for real — the
check script tells you *what's missing*, not *who already ran it and when*, which is what this
file is for.

---

## Scripts, in dependency order

Some scripts depend on an earlier one having already run (e.g. `fix-coded-addresses.ts` needs
`import-psgc-reference-data.ts`'s tables populated first). Run top-to-bottom the first time you
set up a fresh database.

| # | Script | Depends on | Purpose |
|---|---|---|---|
| 1 | `migrate-legacy-data.ts` | — | Main CP12 migration: legacy MongoDB dump → Postgres (loan products, borrowers, loan accounts, transactions). |
| 2 | `import-psgc-reference-data.ts` | — | Loads official PSGC (province/city/barangay) reference tables. |
| 3 | `fix-coded-addresses.ts` | #2 | Resolves raw PSGC codes in `addresses` to names, using the imported reference tables. |
| 4 | `resolve-address-codes.ts` | — | Same category of fix as #3, resolved directly against the legacy `db-address-api` export instead — run after #3; expected to find little/nothing left if #3 already ran. |
| 5 | `migrate-repayment-schedules.ts` | #1 | Populates `RepaymentSchedule` from legacy `repayments.bson` (the original CP12 migration checked the wrong, empty collection). |
| 6 | `flag-missing-balance-loans.ts` | #1 | Flags `LoanAccount.legacyBalanceDataMissing = true` for loans whose legacy export had no account-level balance snapshot at all. |
| 7 | `recompute-active-loan-balances-from-schedule.ts` | #5, #6 | Recomputes real balances for flagged ACTIVE/ACTIVE_IN_ARREARS loans by summing their (now-populated) repayment schedule. |
| — | `verify-migration-counts.ts` | #1 | Read-only row-count dump — sanity check, not a migration step. |
| — | `check-migration-status.ts` | all of the above | Read-only PASS/ACTION-NEEDED report — run this first, always. |
| — | `bootstrap-admin.ts` / `create-additional-mis-user.ts` | — | User account seeding, not legacy data migration. Run once per fresh database as needed, not part of the CP12 chain. |

---

## Per-device status

Update this table whenever you run one of the numbered scripts above for real (not `--dry-run`).

| Script | Jomer's device | Nomer's device |
|---|---|---|
| 1. `migrate-legacy-data.ts` | ✅ 2026-07-08 | ✅ 2026-07-08 |
| 2. `import-psgc-reference-data.ts` | ✅ 2026-07-08 | ✅ (assumed — precedes #3/#4, unconfirmed exact date) |
| 3. `fix-coded-addresses.ts` | ✅ 2026-07-08 | ✅ (assumed, see above) |
| 4. `resolve-address-codes.ts` | ✅ 2026-07-10 | ✅ 2026-07-09 |
| 5. `migrate-repayment-schedules.ts` | ✅ 2026-07-10 | ✅ 2026-07-09 |
| 6. `flag-missing-balance-loans.ts` | ✅ 2026-07-10 | ✅ 2026-07-09 |
| 7. `recompute-active-loan-balances-from-schedule.ts` | ✅ 2026-07-10 | ✅ 2026-07-09 |

**Known open item (both devices likely affected):** `check-migration-status.ts` surfaced one loan
(`SML-REG_00294`) whose repayment schedule shows fully paid (principal + interest, all
installments) but whose `status` is still `ACTIVE_IN_ARREARS`, not `CLOSED` — a genuine legacy
data inconsistency, not a script bug. Flagged for manual review, not auto-fixed (never guess at a
status change). Check with `check-migration-status.ts` whether this still applies before assuming
it's been resolved.

---

## When you add a new one-off script

1. Add it to the dependency-order table above, with what it depends on.
2. Add a corresponding check to `check-migration-status.ts` if there's a clear PASS/FAIL condition
   for "has this been applied."
3. Add a column update reminder to your commit message so whoever pulls it knows to update the
   per-device table after running it.
