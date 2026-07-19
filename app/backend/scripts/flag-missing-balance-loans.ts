/**
 * One-time, idempotent follow-up to CP12 (see docs/Architecture/CP12-legacy-migration-report.md
 * and the 2026-07-09 conversation that found this): 624 of the 1,805 migrated legacy loan
 * accounts had NO account-level balance snapshot fields at all in the legacy export
 * (principalBalance/interestBalance/feesBalance/penaltyBalance were absent, not zero — confirmed
 * by direct inspection of the raw .bson, not assumed). The original migration correctly could not
 * invent a value for an absent field and defaulted those columns to 0.00, which reads as "fully
 * settled" — misleading for a loan that may carry real, uncollected debt (191 of the 624 are
 * Active/ActiveInArrears).
 *
 * Per the same "flag for manual review, never fabricate a number" approach already used for
 * `ADR-007` §4's 79 non-reconciling CLOSED loans, this script sets the new
 * `LoanAccount.legacyBalanceDataMissing` flag to true for exactly this population — no balance
 * value is touched or invented. Read-only against the legacy source, as always.
 *
 * Usage: npx tsx scripts/flag-missing-balance-loans.ts [--dry-run]
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const DUMP_DIR = legacyDbEasycashDir();
const DRY_RUN = process.argv.includes('--dry-run');

function readAll<T = any>(file: string): T[] {
  const buf = fs.readFileSync(path.join(DUMP_DIR, file));
  let offset = 0;
  const docs: T[] = [];
  while (offset < buf.length) {
    const size = buf.readInt32LE(offset);
    docs.push(BSON.deserialize(buf.subarray(offset, offset + size), { promoteValues: true }) as T);
    offset += size;
  }
  return docs;
}

async function main(): Promise<void> {
  console.log(`=== Flag legacy loans with missing balance data ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const legacyLoans = readAll<{ _id: unknown; id: string; uid: string; accountState: string; principalBalance?: number; interestBalance?: number }>(
    'loan_accounts.bson',
  );
  const affected = legacyLoans.filter((l) => l.principalBalance === undefined && l.interestBalance === undefined);
  console.log(`Legacy loans with missing balance fields: ${affected.length} / ${legacyLoans.length}`);

  let flagged = 0, notFound = 0, activeCount = 0;
  const report: { loanCode: string; status: string }[] = [];

  for (const l of affected) {
    const legacyId = l.uid;
    if (l.accountState === 'ACTIVE' || l.accountState === 'ACTIVE_IN_ARREARS') activeCount++;
    const existing = await prisma.loanAccount.findUnique({ where: { legacyId }, select: { id: true, loanCode: true, status: true } });
    if (!existing) { notFound++; continue; }
    report.push({ loanCode: existing.loanCode, status: existing.status });
    if (!DRY_RUN) {
      await prisma.loanAccount.update({ where: { id: existing.id }, data: { legacyBalanceDataMissing: true } });
    }
    flagged++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Flagged: ${flagged} (of which ${activeCount} Active/ActiveInArrears)`);
  console.log(`Not found in current DB (likely skipped during original migration): ${notFound}`);

  const reportPath = path.resolve(__dirname, '../../../docs/Architecture/CP12-missing-balance-loans.md');
  const byStatus = report.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const lines = [
    '# CP12 Follow-up — Loans Flagged for Missing Balance Data',
    '',
    `Generated ${new Date().toISOString()} by \`scripts/flag-missing-balance-loans.ts\`.`,
    '',
    `${report.length} loan accounts have \`legacyBalanceDataMissing = true\` — their legacy record had`,
    'no principal/interest/fees/penalty balance snapshot at all (not zero — absent). All balance',
    'columns on these rows read 0.00 but do NOT mean the loan is settled; each requires manual',
    'reconciliation against other records (e.g. the loan\'s own transaction history\'s running',
    '`balance` field, or physical/legacy paper records) before being treated as collectible or not.',
    '',
    '## By status',
    '',
    '| Status | Count |',
    '|---|---|',
    ...Object.entries(byStatus).map(([status, count]) => `| ${status} | ${count} |`),
    '',
    '## Full list (loan code, status)',
    '',
    '| Loan Code | Status |',
    '|---|---|',
    ...report.sort((a, b) => a.loanCode.localeCompare(b.loanCode)).map((r) => `| ${r.loanCode} | ${r.status} |`),
    '',
  ];
  if (!DRY_RUN) fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(`\nReport written to: ${reportPath}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
