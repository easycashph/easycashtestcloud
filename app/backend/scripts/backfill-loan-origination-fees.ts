/**
 * DRY-RUN by default (per established norm: confirm live-data backfills before applying).
 * Source: legacy/reports/BETA 1.5.83 LMSv3.xlsm, "Loans_details" sheet - MIS Nomer's own
 * hand-built Excel LMS, cross-referenced 2026-07-17 after the user asked why the Loan Releases
 * Report showed 0.00 fees for legacy-migrated loans. Confirmed: the origination fee fields on
 * LoanAccount (processingFee/advanceInterestFee/etc.) were added 2026-07-11 for NEW loans only,
 * never backfilled from legacy data during CP12 migration - all 1,783 legacy-migrated loans show
 * 0 across every fee column, both in the live DB and in a 2026-07-14 database snapshot.
 *
 * Only touches LoanAccounts matched by loanCode (== the Excel's "Loan Account Id" column) whose
 * fee columns are ALL currently zero - never overwrites a loan that already has real fee data
 * (the 7 loans created after migration through the real Create Loan Account form).
 *
 * Usage:
 *   npx tsx scripts/backfill-loan-origination-fees.ts          (dry run - prints the plan only)
 *   npx tsx scripts/backfill-loan-origination-fees.ts --apply  (writes to the database)
 */
import ExcelJS from 'exceljs';
import { prisma } from '../src/shared/database/prismaClient';

const EXCEL_PATH = 'C:/ECLC CLAUDE CODE/legacy/reports/BETA 1.5.83 LMSv3.xlsm';

interface ExcelFeeRow {
  loanAccountId: string;
  processingFee: number;
  advanceInterestFee: number;
  outstandingLoanBalance: number;
  docStamp: number;
  accountManagementFee: number;
  others: number;
  notarialFee: number;
  webFee: number;
  insuranceFee: number;
  netProceeds: number | null;
}

function num(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readExcelFeeRows(): Promise<ExcelFeeRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.getWorksheet('Loans_details');
  if (!sheet) throw new Error('Loans_details sheet not found');

  const rows: ExcelFeeRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const loanAccountId = row.getCell(8).value;
    if (!loanAccountId || typeof loanAccountId !== 'string') continue;

    rows.push({
      loanAccountId: loanAccountId.trim(),
      processingFee: num(row.getCell(16).value),
      advanceInterestFee: num(row.getCell(17).value),
      outstandingLoanBalance: num(row.getCell(18).value),
      docStamp: num(row.getCell(19).value),
      accountManagementFee: num(row.getCell(21).value),
      others: num(row.getCell(22).value),
      notarialFee: num(row.getCell(23).value),
      webFee: num(row.getCell(24).value),
      insuranceFee: num(row.getCell(25).value),
      netProceeds: row.getCell(29).value ? num(row.getCell(29).value) : null,
    });
  }
  return rows;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const excelRows = await readExcelFeeRows();
  console.log(`Read ${excelRows.length} rows from Loans_details.`);

  const loanCodes = excelRows.map((r) => r.loanAccountId);
  const loans = await prisma.loanAccount.findMany({
    where: { loanCode: { in: loanCodes } },
    select: {
      id: true,
      loanCode: true,
      legacyId: true,
      processingFee: true,
      advanceInterestFee: true,
      outstandingBalancePayoff: true,
      docStampFee: true,
      accountManagementFee: true,
      otherFees: true,
      notarialFee: true,
      webFee: true,
      insuranceFee: true,
      netProceeds: true,
    },
  });
  const loanByCode = new Map(loans.map((l) => [l.loanCode, l]));

  let matched = 0;
  let alreadyHasFees = 0;
  let noMatch = 0;
  const toApply: { loanCode: string; id: string; data: Record<string, number> }[] = [];

  for (const excelRow of excelRows) {
    const loan = loanByCode.get(excelRow.loanAccountId);
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

    const excelAllZeroToo =
      excelRow.processingFee === 0 &&
      excelRow.advanceInterestFee === 0 &&
      excelRow.outstandingLoanBalance === 0 &&
      excelRow.docStamp === 0 &&
      excelRow.accountManagementFee === 0 &&
      excelRow.others === 0 &&
      excelRow.notarialFee === 0 &&
      excelRow.webFee === 0 &&
      excelRow.insuranceFee === 0;
    if (excelAllZeroToo) continue; // nothing to backfill for this one - genuinely no fees on this loan

    toApply.push({
      loanCode: excelRow.loanAccountId,
      id: loan.id,
      data: {
        processingFee: excelRow.processingFee,
        advanceInterestFee: excelRow.advanceInterestFee,
        outstandingBalancePayoff: excelRow.outstandingLoanBalance,
        docStampFee: excelRow.docStamp,
        accountManagementFee: excelRow.accountManagementFee,
        otherFees: excelRow.others,
        notarialFee: excelRow.notarialFee,
        webFee: excelRow.webFee,
        insuranceFee: excelRow.insuranceFee,
      },
    });
  }

  console.log(`Matched by loanCode: ${matched}`);
  console.log(`Already have real fee data (skipped, not touched): ${alreadyHasFees}`);
  console.log(`No matching LoanAccount in our DB: ${noMatch}`);
  console.log(`Would backfill (currently all-zero, Excel has real values): ${toApply.length}`);
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
