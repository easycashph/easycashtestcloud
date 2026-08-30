/**
 * One-time backfill (2026-08-30, user-confirmed): populates `LoanAccount.cicProviderContractNo`
 * for loans already submitted to CIC before this feature existed, using the company's historical
 * "Loan Accounts Details" sheet (same workbook as the Client Master List - see
 * backfill-cic-provider-subject-no.ts's own doc comment for why an identity-matching approach is
 * needed at all: `ACCOUNT ID` there doesn't correspond to any ID this LMS stores, verified against
 * the current SDevTech MongoDB dump and this system's own `LoanAccount.legacyId`).
 *
 * Matching strategy: the sheet's own "Macro Provided ID" column already links each loan to its
 * borrower - so first resolve the Borrower via `cicProviderSubjectNo` (must already be backfilled -
 * run backfill-cic-provider-subject-no.ts first), then among THAT borrower's loans, match by
 * principal amount + installment count + activation date, each only accepted when it resolves to
 * exactly ONE LoanAccount. Never overwrites an existing value, never guesses an ambiguous match.
 *
 * Usage:
 *   npx tsx scripts/backfill-cic-provider-contract-no.ts          # dry run - reports only
 *   npx tsx scripts/backfill-cic-provider-contract-no.ts --apply  # writes matches
 */
import 'dotenv/config';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');

const SOURCE_FILE = path.resolve(
  __dirname,
  '../../../legacy/CIC /07 2026 July/[July 2026] Fields in Google Spreadsheet.xlsx',
);

interface LoanDetailRow {
  accountId: string;
  macroProvidedId: string;
  loanAmount: number | null;
  installments: number | null;
  activationDate: Date | null;
}

function toDateOnly(v: unknown): Date | null {
  if (v instanceof Date) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  return null;
}

async function loadLoanDetails(): Promise<LoanDetailRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE_FILE);
  const sheet = workbook.getWorksheet('Loan Accounts Details');
  if (!sheet) throw new Error(`"Loan Accounts Details" sheet not found in ${SOURCE_FILE}`);

  const rows: LoanDetailRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (col: number) => row.getCell(col).value;
    const accountId = String(get(4) ?? '').trim(); // ACCOUNT ID
    const macroProvidedId = String(get(13) ?? '').trim(); // Macro Provided ID
    if (!accountId || !macroProvidedId) return;

    rows.push({
      accountId,
      macroProvidedId,
      loanAmount: typeof get(8) === 'number' ? (get(8) as number) : null,
      installments: typeof get(9) === 'number' ? (get(9) as number) : null,
      activationDate: toDateOnly(get(7)),
    });
  });
  return rows;
}

async function main(): Promise<void> {
  console.log(`=== CIC Provider Contract No backfill (${APPLY ? 'APPLY' : 'dry run'}) ===`);
  console.log(`Source: ${SOURCE_FILE}`);

  const loanDetailRows = await loadLoanDetails();
  console.log(`Loaded ${loanDetailRows.length} Loan Accounts Details row(s).`);

  const borrowers = await prisma.borrower.findMany({
    where: { cicProviderSubjectNo: { not: null } },
    select: { id: true, cicProviderSubjectNo: true },
  });
  const borrowerIdBySubjectNo = new Map(borrowers.map((b) => [b.cicProviderSubjectNo as string, b.id]));

  const loans = await prisma.loanAccount.findMany({
    select: {
      id: true,
      loanCode: true,
      borrowerId: true,
      principalAmount: true,
      installmentCount: true,
      activatedAt: true,
      cicProviderContractNo: true,
    },
  });
  const loansByBorrowerId = new Map<string, typeof loans>();
  for (const loan of loans) {
    const list = loansByBorrowerId.get(loan.borrowerId) ?? [];
    list.push(loan);
    loansByBorrowerId.set(loan.borrowerId, list);
  }

  let matched = 0;
  let alreadySet = 0;
  let noBorrower = 0;
  let ambiguous = 0;
  let unmatched = 0;
  const ambiguousRows: LoanDetailRow[] = [];
  const unmatchedRows: LoanDetailRow[] = [];

  for (const row of loanDetailRows) {
    const borrowerId = borrowerIdBySubjectNo.get(row.macroProvidedId);
    if (!borrowerId) {
      noBorrower++;
      continue;
    }

    const candidateLoans = (loansByBorrowerId.get(borrowerId) ?? []).filter((loan) => {
      const amountMatches = row.loanAmount === null || Math.abs(Number(loan.principalAmount) - row.loanAmount) < 1;
      const installmentsMatch = row.installments === null || loan.installmentCount === row.installments;
      const activationMatches =
        row.activationDate === null ||
        !loan.activatedAt ||
        Math.abs(loan.activatedAt.getTime() - row.activationDate.getTime()) < 3 * 24 * 60 * 60 * 1000; // 3-day tolerance for timezone/rounding drift
      return amountMatches && installmentsMatch && activationMatches;
    });

    if (candidateLoans.length === 0) {
      unmatched++;
      unmatchedRows.push(row);
      continue;
    }
    if (candidateLoans.length > 1) {
      ambiguous++;
      ambiguousRows.push(row);
      continue;
    }

    const loan = candidateLoans[0];
    if (loan.cicProviderContractNo) {
      alreadySet++;
      continue;
    }

    matched++;
    console.log(`  ${loan.loanCode} -> ${row.accountId}`);
    if (APPLY) {
      await prisma.loanAccount.update({ where: { id: loan.id }, data: { cicProviderContractNo: row.accountId } });
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Matched (${APPLY ? 'written' : 'would write'}): ${matched}`);
  console.log(`Already had a value (skipped): ${alreadySet}`);
  console.log(`No matching Borrower (subject not backfilled or not in this LMS): ${noBorrower}`);
  console.log(`Ambiguous (multiple loans matched - not touched): ${ambiguous}`);
  console.log(`Unmatched (no loan found - not touched): ${unmatched}`);

  if (ambiguousRows.length > 0) {
    console.log('\nAmbiguous rows (need manual review):');
    for (const r of ambiguousRows.slice(0, 20)) console.log(`  ${r.accountId} (${r.macroProvidedId})`);
    if (ambiguousRows.length > 20) console.log(`  ... and ${ambiguousRows.length - 20} more`);
  }

  if (!APPLY) console.log('\nDry run only - re-run with --apply to write these changes.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
