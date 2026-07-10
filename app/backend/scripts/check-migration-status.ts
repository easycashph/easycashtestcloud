/**
 * Migration status health check — read-only, no writes. Reports whether the known CP12 legacy-
 * migration follow-up scripts (see docs/DEVICE_SYNC_GUIDE.md §3) have already been applied to
 * THIS machine's local database, so you don't have to manually psql/guess before deciding whether
 * to re-run something (this is exactly the confusion that prompted writing this script — see the
 * migration ledger in docs/Architecture/MIGRATION_LEDGER.md).
 *
 * Each check reports a plain PASS/ACTION NEEDED verdict plus the numbers behind it. Never writes
 * to the database and never guesses at whether a partial state is "close enough" — every check
 * states its own exact evidence.
 *
 * Usage: npx tsx scripts/check-migration-status.ts
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const ACTIVE_STATUSES = ['ACTIVE', 'ACTIVE_IN_ARREARS'] as const;

function verdict(pass: boolean): string {
  return pass ? 'PASS' : 'ACTION NEEDED';
}

async function main(): Promise<void> {
  console.log('=== Migration status check (read-only) ===\n');

  // 1. PSGC reference data (import-psgc-reference-data.ts)
  const [provinces, cities, barangays] = await Promise.all([
    prisma.psgcProvince.count(),
    prisma.psgcCityMunicipality.count(),
    prisma.psgcBarangay.count(),
  ]);
  const psgcLoaded = provinces > 0 && cities > 0 && barangays > 0;
  console.log(`[${verdict(psgcLoaded)}] PSGC reference data (import-psgc-reference-data.ts)`);
  console.log(`  provinces=${provinces} cities=${cities} barangays=${barangays}`);
  if (!psgcLoaded) console.log('  -> Run: npx tsx scripts/import-psgc-reference-data.ts');

  // 2. Address code resolution (fix-coded-addresses.ts / resolve-address-codes.ts). Prisma has no
  // native regex filter for Postgres, so this check runs as a raw query.
  const codedRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint as count FROM addresses WHERE province ~ '^[0-9]{4}$' OR "cityMunicipality" ~ '^[0-9]{6}$' OR barangay ~ '^[0-9]{9}$'`,
  );
  const stillCoded = Number(codedRows[0]?.count ?? 0);
  console.log(`\n[${verdict(stillCoded === 0)}] Address code resolution (fix-coded-addresses.ts / resolve-address-codes.ts)`);
  console.log(`  addresses still storing raw PSGC codes: ${stillCoded}`);
  if (stillCoded > 0) console.log('  -> Run: npx tsx scripts/resolve-address-codes.ts --dry-run   (then without --dry-run)');

  // 3. Repayment schedule migration (migrate-repayment-schedules.ts)
  const scheduleRows = await prisma.repaymentSchedule.count();
  const loansWithSchedule = await prisma.loanAccount.count({ where: { repaymentSchedule: { some: {} } } });
  const scheduleLoaded = scheduleRows > 0;
  console.log(`\n[${verdict(scheduleLoaded)}] Repayment schedule migration (migrate-repayment-schedules.ts)`);
  console.log(`  installment rows=${scheduleRows}, loans with at least one installment=${loansWithSchedule}`);
  if (!scheduleLoaded) console.log('  -> Run: npx tsx scripts/migrate-repayment-schedules.ts --dry-run   (then without --dry-run)');

  // 4. Missing-balance flag (flag-missing-balance-loans.ts)
  const flaggedCount = await prisma.loanAccount.count({ where: { legacyBalanceDataMissing: true } });
  console.log(`\n[${verdict(flaggedCount > 0)}] Missing-balance flag (flag-missing-balance-loans.ts)`);
  console.log(`  loans flagged legacyBalanceDataMissing=true: ${flaggedCount}`);
  if (flaggedCount === 0) console.log('  -> Run: npx tsx scripts/flag-missing-balance-loans.ts --dry-run   (then without --dry-run)');

  // 5. Balance recompute (recompute-active-loan-balances-from-schedule.ts)
  const stillZeroActive = await prisma.loanAccount.count({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      legacyBalanceDataMissing: true,
      principalBalance: 0,
      principalAmount: { gt: 0 },
    },
  });
  console.log(`\n[${verdict(stillZeroActive === 0)}] Balance recompute (recompute-active-loan-balances-from-schedule.ts)`);
  console.log(`  active/in-arrears loans flagged missing AND still reading ₱0.00 principal balance: ${stillZeroActive}`);
  if (stillZeroActive > 0) {
    console.log('  -> Run: npx tsx scripts/recompute-active-loan-balances-from-schedule.ts --dry-run   (then without --dry-run)');
    console.log('  (a small remainder with no schedule rows at all is expected and gets left untouched — see the script\'s own summary)');
  }

  // 6. Prisma schema migrations (structural — separate from the data-fix scripts above)
  const pendingMigrations = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL`,
  ).catch(() => []);
  console.log(`\n[${verdict(pendingMigrations.length === 0)}] Prisma schema migrations`);
  if (pendingMigrations.length > 0) {
    console.log(`  ${pendingMigrations.length} migration(s) not finished — run: npx prisma migrate deploy`);
    for (const m of pendingMigrations) console.log(`    - ${m.migration_name}`);
  } else {
    console.log('  no unfinished migrations recorded (run `npx prisma migrate status` for the full picture, incl. unapplied files)');
  }

  console.log('\n=== Done. Cross-check against docs/Architecture/MIGRATION_LEDGER.md before re-running anything. ===');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
