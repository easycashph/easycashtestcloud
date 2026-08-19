/**
 * DRY-RUN by default (per established norm: confirm live-data backfills before applying).
 * Source: `scripts/data/origination-fees-excel-snapshot.json` - a committed, repeatable snapshot
 * of `legacy/reports/BETA 1.5.83 LMSv3.xlsm`'s "Loans_details" sheet (MIS Nomer's own hand-built
 * Excel LMS), taken 2026-08-19 once that machine-local file was finally made available on the
 * Office Server PC. Originally this script read the .xlsm directly, which meant a full-reset
 * migration failed at this step on any machine that didn't happen to have a copy of that file
 * (see session log §27) - snapshotting the matched rows into the repo makes this step work the
 * same way everywhere, with no dependency on a machine-local Excel file, matching this project's
 * "migration should be repeatable" principle (CLAUDE.md). The original .xlsm remains the source of
 * truth if the snapshot ever needs regenerating for newly-added legacy loans - see
 * `scripts/generate-origination-fees-snapshot.ts`.
 *
 * Matched by loanCode (== the Excel's "Loan Account Id" column). Only touches LoanAccounts whose
 * fee columns are ALL currently zero - never overwrites a loan that already has real fee data
 * (e.g. a loan created after migration through the real Create Loan Account form, or one already
 * backfilled by an earlier run of this script or its 13b/13c MongoDB/inferred fallback siblings).
 *
 * Usage:
 *   npx tsx scripts/backfill-loan-origination-fees.ts          (dry run - prints the plan only)
 *   npx tsx scripts/backfill-loan-origination-fees.ts --apply  (writes to the database)
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { prisma } from '../src/shared/database/prismaClient';

const SNAPSHOT_PATH = path.resolve(__dirname, 'data/origination-fees-excel-snapshot.json');

interface SnapshotFeeRow {
  loanCode: string;
  legacyId: string | null;
  processingFee: number;
  advanceInterestFee: number;
  outstandingBalancePayoff: number;
  docStampFee: number;
  accountManagementFee: number;
  otherFees: number;
  notarialFee: number;
  webFee: number;
  insuranceFee: number;
}

function readSnapshotFeeRows(): SnapshotFeeRow[] {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    throw new Error(`Snapshot not found: ${SNAPSHOT_PATH}`);
  }
  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')) as SnapshotFeeRow[];
}

async function main() {
  const apply = process.argv.includes('--apply');
  const snapshotRows = readSnapshotFeeRows();
  console.log(`Read ${snapshotRows.length} rows from origination-fees-excel-snapshot.json.`);

  const loanCodes = snapshotRows.map((r) => r.loanCode);
  const loans = await prisma.loanAccount.findMany({
    where: { loanCode: { in: loanCodes } },
    select: {
      id: true,
      loanCode: true,
      processingFee: true,
      advanceInterestFee: true,
      outstandingBalancePayoff: true,
      docStampFee: true,
      accountManagementFee: true,
      otherFees: true,
      notarialFee: true,
      webFee: true,
      insuranceFee: true,
    },
  });
  const loanByCode = new Map(loans.map((l) => [l.loanCode, l]));

  let matched = 0;
  let alreadyHasFees = 0;
  let noMatch = 0;
  const toApply: { loanCode: string; id: string; data: Record<string, number> }[] = [];

  for (const row of snapshotRows) {
    const loan = loanByCode.get(row.loanCode);
    if (!loan) {
      noMatch++;
      continue;
    }
    matched++;

    const currentlyAllZero =
      Number(loan.processingFee) === 0 &&
      Number(loan.advanceInterestFee) === 0 &&
      Number(loan.outstandingBalancePayoff) === 0 &&
      Number(loan.docStampFee) === 0 &&
      Number(loan.accountManagementFee) === 0 &&
      Number(loan.otherFees) === 0 &&
      Number(loan.notarialFee) === 0 &&
      Number(loan.webFee) === 0 &&
      Number(loan.insuranceFee) === 0;

    if (!currentlyAllZero) {
      alreadyHasFees++;
      continue;
    }

    toApply.push({
      loanCode: row.loanCode,
      id: loan.id,
      data: {
        processingFee: row.processingFee,
        advanceInterestFee: row.advanceInterestFee,
        outstandingBalancePayoff: row.outstandingBalancePayoff,
        docStampFee: row.docStampFee,
        accountManagementFee: row.accountManagementFee,
        otherFees: row.otherFees,
        notarialFee: row.notarialFee,
        webFee: row.webFee,
        insuranceFee: row.insuranceFee,
      },
    });
  }

  console.log(`Matched by loanCode: ${matched}`);
  console.log(`Already have real fee data (skipped, not touched): ${alreadyHasFees}`);
  console.log(`No matching LoanAccount in our DB: ${noMatch}`);
  console.log(`Would backfill (currently all-zero, snapshot has real values): ${toApply.length}`);
  console.log('');
  console.log('Sample of what would change (first 10):');
  for (const row of toApply.slice(0, 10)) {
    console.log(`  ${row.loanCode}:`, row.data);
  }

  if (!apply) {
    console.log('\nDRY RUN ONLY - no changes written. Re-run with --apply to write these changes.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nAPPLYING ${toApply.length} updates...`);
  for (const row of toApply) {
    await prisma.loanAccount.update({ where: { id: row.id }, data: row.data });
  }
  console.log('Done.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
