/**
 * Regenerates `scripts/data/origination-fees-excel-snapshot.json` from
 * `legacy/reports/BETA 1.5.83 LMSv3.xlsm` ("Loans_details" sheet). Only needed if that Excel file
 * gets new/updated rows for legacy loans not yet covered by the committed snapshot - the normal
 * migration flow (`backfill-loan-origination-fees.ts`) reads the snapshot directly and does NOT
 * need the .xlsm present. See that script's own doc comment for why this snapshot exists.
 *
 * Matches each Excel row against the current DB by loanCode, keeps only rows with a real
 * LoanAccount match and at least one non-zero fee field (a genuinely-zero row has nothing to add
 * over what a fresh migration already produces).
 *
 * Usage:
 *   npx tsx scripts/generate-origination-fees-snapshot.ts
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import ExcelJS from 'exceljs';
import { prisma } from '../src/shared/database/prismaClient';

const EXCEL_PATH = path.resolve(__dirname, '../../../legacy/reports/BETA 1.5.83 LMSv3.xlsm');
const SNAPSHOT_PATH = path.resolve(__dirname, 'data/origination-fees-excel-snapshot.json');

function num(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`X Excel file not found: ${EXCEL_PATH}`);
    console.error('  Kailangan mo munang i-copy ang BETA 1.5.83 LMSv3.xlsm dito bago i-regenerate ang snapshot.');
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.getWorksheet('Loans_details');
  if (!sheet) throw new Error('Loans_details sheet not found');

  const excelRows: Record<string, unknown>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const loanAccountId = row.getCell(8).value;
    if (!loanAccountId || typeof loanAccountId !== 'string') continue;
    excelRows.push({
      loanCode: loanAccountId.trim(),
      processingFee: num(row.getCell(16).value),
      advanceInterestFee: num(row.getCell(17).value),
      outstandingBalancePayoff: num(row.getCell(18).value),
      docStampFee: num(row.getCell(19).value),
      accountManagementFee: num(row.getCell(21).value),
      otherFees: num(row.getCell(22).value),
      notarialFee: num(row.getCell(23).value),
      webFee: num(row.getCell(24).value),
      insuranceFee: num(row.getCell(25).value),
    });
  }

  const loans = await prisma.loanAccount.findMany({
    where: { loanCode: { in: excelRows.map((r) => r.loanCode as string) } },
    select: { loanCode: true, legacyId: true },
  });
  const legacyByCode = new Map(loans.map((l) => [l.loanCode, l.legacyId]));

  const snapshot = excelRows
    .filter((row) => legacyByCode.has(row.loanCode as string))
    .filter((row) =>
      [
        'processingFee',
        'advanceInterestFee',
        'outstandingBalancePayoff',
        'docStampFee',
        'accountManagementFee',
        'otherFees',
        'notarialFee',
        'webFee',
        'insuranceFee',
      ].some((field) => Number(row[field]) !== 0),
    )
    .map((row) => ({ ...row, legacyId: legacyByCode.get(row.loanCode as string) ?? null }));

  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Wrote ${snapshot.length} rows to ${SNAPSHOT_PATH}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
