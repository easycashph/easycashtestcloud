import ExcelJs from 'exceljs';

export interface TabularColumn<Row> {
  header: string;
  key: keyof Row & string;
  width: number;
  /** ExcelJS number format string, e.g. 'mm/dd/yyyy' or '#,##0.00'. Omit for plain text/number cells. */
  numFmt?: string;
  /** Cells for this column are treated as currency for the optional totals row's SUM(). */
  isMoney?: boolean;
}

export interface TabularXlsxOptions<Row> {
  sheetName: string;
  columns: TabularColumn<Row>[];
  rows: Row[];
  /** Adds a bold trailing row summing every `isMoney` column, with `label` in the first column. */
  totals?: { label: string };
}

/**
 * 2026-07-17 (Reports): shared writer for every "one flat table -> one .xlsx sheet" report
 * (Aging, Ending Balance, Accounts with Past Due, Collection, Expected Collection, First
 * Amortization, Daily Collection, Fully Paid Accounts) - factored out of
 * `ExcelJsLoanReleasesReportWriter` (left as-is, it predates this and already works) so each new
 * report is just a column list, not a duplicated writer class.
 */
export async function writeTabularXlsx<Row>(options: TabularXlsxOptions<Row>): Promise<Buffer> {
  const { sheetName, columns, rows, totals } = options;
  const workbook = new ExcelJs.Workbook();
  workbook.creator = 'Easycash LMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const record: Record<string, unknown> = {};
    for (const column of columns) {
      const value = row[column.key];
      record[column.key] = value === null || value === undefined ? null : column.isMoney ? Number(value) : value;
    }
    sheet.addRow(record);
  }

  for (const column of columns) {
    if (!column.numFmt) continue;
    sheet.getColumn(column.key).numFmt = column.numFmt;
  }

  if (totals) {
    const moneyColumns = columns.filter((c) => c.isMoney);
    const totalsRow = sheet.addRow({});
    totalsRow.getCell(columns[0]!.key).value = totals.label;
    totalsRow.font = { bold: true };
    for (const column of moneyColumns) {
      const columnLetter = sheet.getColumn(column.key).letter;
      const dataRange = `${columnLetter}2:${columnLetter}${sheet.rowCount - 1}`;
      totalsRow.getCell(column.key).value = { formula: `SUM(${dataRange})` };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
