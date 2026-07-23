/**
 * One-time, idempotent follow-up to ADR-007 §4 (2026-07-08 decision, "Option A" — migrate all
 * legacy CLOSED loans as-is, flag the non-reconciling ones for manual accounting review, never
 * fabricate a corrected balance).
 *
 * That decision was recorded in ADR-007-outstanding-balance-formula.md and
 * CP12_LEGACY_MIGRATION_DESIGN.md, but the actual `LoanAccount.legacyNonReconcilingClosedBalance`
 * flag it called for was never backfilled - this script does that now (2026-07-23 reconciliation
 * follow-up). Reads directly from the already-migrated Postgres data, not the legacy MongoDB dump:
 * the population is exactly defined as `status = CLOSED` AND the four balance columns sum to a
 * non-zero amount, excluding loans already flagged `legacyBalanceDataMissing` (a different,
 * mutually-exclusive data-quality issue - no balance snapshot at all, vs. a present-but-non-zero
 * one here). Confirmed this query returns exactly 79 rows, matching ADR-007 §4's documented
 * population size exactly.
 *
 * Usage:
 *   npx tsx scripts/flag-non-reconciling-closed-loans.ts            # dry run - reports, writes nothing
 *   npx tsx scripts/flag-non-reconciling-closed-loans.ts --apply    # actually writes
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  const affected = await prisma.loanAccount.findMany({
    where: {
      status: 'CLOSED',
      legacyBalanceDataMissing: false,
      NOT: {
        AND: [{ principalBalance: 0 }, { interestBalance: 0 }, { feesBalance: 0 }, { penaltyBalance: 0 }],
      },
    },
    select: {
      id: true,
      loanCode: true,
      principalBalance: true,
      interestBalance: true,
      feesBalance: true,
      penaltyBalance: true,
      legacyNonReconcilingClosedBalance: true,
    },
  });

  console.log(`=== Flag ADR-007 §4 non-reconciling CLOSED loans ${APPLY ? '' : '(DRY RUN - no writes)'} ===`);
  console.log(`Found: ${affected.length} CLOSED loans with a non-zero balance sum (expected 79 per ADR-007 §4).`);

  const alreadyFlagged = affected.filter((a) => a.legacyNonReconcilingClosedBalance).length;
  console.log(`Already flagged: ${alreadyFlagged}. To flag this run: ${affected.length - alreadyFlagged}.`);

  if (APPLY) {
    await prisma.loanAccount.updateMany({
      where: { id: { in: affected.map((a) => a.id) } },
      data: { legacyNonReconcilingClosedBalance: true },
    });
  }

  const report = affected
    .map((a) => ({
      loanCode: a.loanCode,
      balanceSum: new Prisma.Decimal(a.principalBalance)
        .plus(a.interestBalance)
        .plus(a.feesBalance)
        .plus(a.penaltyBalance)
        .toFixed(2),
    }))
    .sort((a, b) => a.loanCode.localeCompare(b.loanCode));

  const reportPath = path.resolve(__dirname, '../../../docs/Architecture/ADR-007-non-reconciling-closed-loans.md');
  const lines = [
    '# ADR-007 §4 Follow-up — Loans Flagged for Non-Reconciling Closed Balance',
    '',
    `Generated ${new Date().toISOString()} by \`scripts/flag-non-reconciling-closed-loans.ts\`.`,
    '',
    `${report.length} loan accounts have \`legacyNonReconcilingClosedBalance = true\` — each is`,
    'marked CLOSED (legacy-migrated, believed fully settled) but its migrated balance columns',
    '(principal + interest + fees + penalty) sum to a non-zero amount. Per ADR-007 §4\'s decision',
    '(Option A, confirmed by Nomer Perez, MIS Manager, 2026-07-08), these are migrated as-is - no',
    'balance figure here was corrected or invented - and flagged for manual accounting review.',
    '',
    '## Full list (loan code, balance sum that should be ₱0.00)',
    '',
    '| Loan Code | Balance Sum |',
    '|---|---|',
    ...report.map((r) => `| ${r.loanCode} | ₱${r.balanceSum} |`),
    '',
  ];
  if (APPLY) fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(`\n${APPLY ? 'Report written to' : 'Would write report to (dry run)'}: ${reportPath}`);

  if (!APPLY) {
    console.log('\nDry run complete - no data was written. Re-run with --apply to write to the database.');
  } else {
    const total = await prisma.loanAccount.count({ where: { legacyNonReconcilingClosedBalance: true } });
    console.log(`\nApplied: ${total} loan accounts now have legacyNonReconcilingClosedBalance = true.`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exitCode = 1;
});
