import ExcelJs from 'exceljs';
import type { LoanReleaseReportRow } from '../application/ports/IReportingRepository';

/**
 * Column order and headers match the legacy Excel report exactly (`legacy/reports/.../
 * Monthly-Loan-Releases (2).xlsx`, header row verified 2026-07-15) — this is a like-for-like
 * replacement, not a redesign, so staff already familiar with the old report recognize this one
 * immediately.
 */
const COLUMNS: { header: string; key: keyof LoanReleaseReportRow | 'blank'; width: number; numFmt?: string }[] = [
  { header: 'Client ID', key: 'clientId', width: 22 },
  { header: 'Client Name', key: 'clientName', width: 28 },
  { header: 'Address', key: 'address', width: 40 },
  { header: 'Product', key: 'product', width: 16 },
  { header: 'Account ID', key: 'accountId', width: 16 },
  { header: 'Agency / Company', key: 'agencyCompany', width: 28 },
  { header: 'Disbursement Date', key: 'disbursementDate', width: 16, numFmt: 'mm/dd/yyyy' },
  { header: 'Loan Created', key: 'loanCreated', width: 16, numFmt: 'mm/dd/yyyy' },
  { header: 'Maturity Date', key: 'maturityDate', width: 16, numFmt: 'mm/dd/yyyy' },
  { header: 'Term', key: 'term', width: 8 },
  { header: 'Nth Loan', key: 'nthLoan', width: 10 },
  { header: 'New/Renew', key: 'newOrRenew', width: 12 },
  { header: 'First Repayment Date', key: 'firstRepaymentDate', width: 18, numFmt: 'mm/dd/yyyy' },
  { header: 'Amortization', key: 'amortization', width: 14, numFmt: '#,##0.00' },
  { header: 'Loan Amount', key: 'loanAmount', width: 14, numFmt: '#,##0.00' },
  { header: 'Total Interest', key: 'totalInterest', width: 14, numFmt: '#,##0.00' },
  { header: 'Total OB', key: 'totalOB', width: 14, numFmt: '#,##0.00' },
  { header: 'Add-On Interest Rate', key: 'addOnInterestRate', width: 16 },
  { header: 'Contractual Interest Rate', key: 'contractualInterestRate', width: 18 },
  { header: 'Advance Interest Fee', key: 'advanceInterestFee', width: 16, numFmt: '#,##0.00' },
  { header: 'Processing Fee', key: 'processingFee', width: 14, numFmt: '#,##0.00' },
  { header: 'Documentation Fee', key: 'documentationFee', width: 14, numFmt: '#,##0.00' },
  { header: 'Outstanding Loan Balance', key: 'outstandingLoanBalance', width: 18, numFmt: '#,##0.00' },
  { header: 'Account Management Fee', key: 'accountManagementFee', width: 18, numFmt: '#,##0.00' },
  { header: 'Insurance', key: 'insurance', width: 12, numFmt: '#,##0.00' },
  { header: 'Notarial', key: 'notarial', width: 12, numFmt: '#,##0.00' },
  { header: 'Web Fee', key: 'webFee', width: 12, numFmt: '#,##0.00' },
  { header: 'Total Net Amount', key: 'totalNetAmount', width: 16, numFmt: '#,##0.00' },
];

const MONEY_KEYS: ReadonlySet<string> = new Set([
  'amortization',
  'loanAmount',
  'totalInterest',
  'totalOB',
  'advanceInterestFee',
  'processingFee',
  'documentationFee',
  'outstandingLoanBalance',
  'accountManagementFee',
  'insurance',
  'notarial',
  'webFee',
  'totalNetAmount',
]);

const DATE_KEYS: ReadonlySet<string> = new Set([
  'disbursementDate',
  'loanCreated',
  'maturityDate',
  'firstRepaymentDate',
]);

function cellValue(row: LoanReleaseReportRow, key: keyof LoanReleaseReportRow): string | number | Date | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (DATE_KEYS.has(key)) return value as Date;
  if (MONEY_KEYS.has(key)) return Number(value);
  return value as string | number;
}

/**
 * Builds the Monthly Loan Releases report as a real `.xlsx` workbook (styling, currency
 * formatting — not a client-side CSV shortcut), per `docs/SESSION_LOG_2026-07-15.md`'s
 * scoping discussion. Deliberately a plain writer class, not a repository/use-case — this is a
 * presentation-format concern (how the already-fetched rows become bytes), same layer as
 * `DocxtemplaterDocumentFiller` in the loan-document module.
 */
export class ExcelJsLoanReleasesReportWriter {
  async write(rows: LoanReleaseReportRow[]): Promise<Buffer> {
    const workbook = new ExcelJs.Workbook();
    workbook.creator = 'Easycash LMS';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Loan Releases');
    sheet.columns = COLUMNS.map((column) => ({ header: column.header, key: column.key, width: column.width }));
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      const record: Record<string, string | number | Date | null> = {};
      for (const column of COLUMNS) {
        if (column.key === 'blank') continue;
        record[column.key] = cellValue(row, column.key);
      }
      sheet.addRow(record);
    }

    for (const column of COLUMNS) {
      if (!column.numFmt) continue;
      sheet.getColumn(column.key).numFmt = column.numFmt;
    }

    const totalsRow = sheet.addRow({});
    totalsRow.getCell('clientId').value = `Total (${rows.length} loan${rows.length === 1 ? '' : 's'})`;
    totalsRow.font = { bold: true };
    for (const key of MONEY_KEYS) {
      const columnLetter = sheet.getColumn(key).letter;
      const dataRange = `${columnLetter}2:${columnLetter}${sheet.rowCount - 1}`;
      totalsRow.getCell(key).value = { formula: `SUM(${dataRange})` };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
