import { writeTabularXlsx, type TabularColumn } from '@shared/infrastructure/writeTabularXlsx';
import type {
  AccountsWithPastDueReportRow,
  AgingReportRow,
  CollectionHistoryReportRow,
  DailyCollectionReportRow,
  EndingBalanceReportRow,
  ExpectedCollectionReportRow,
  FirstAmortizationReportRow,
  FullyPaidAccountsReportRow,
  PortalAccountReportRow,
} from '../application/ports/IReportingRepository';

const DATE_FMT = 'mm/dd/yyyy';
const MONEY_FMT = '#,##0.00';

/** Column order/headers match each legacy `.xlsx` sample exactly (header rows verified 2026-07-17,
 * `C:\Users\EASYCASH\Downloads\Reports\`) - like-for-like replacements, same convention as
 * `ExcelJsLoanReleasesReportWriter`. */

const AGING_COLUMNS: TabularColumn<AgingReportRow>[] = [
  { header: 'Client Name', key: 'clientName', width: 28 },
  { header: 'Product', key: 'product', width: 16 },
  { header: 'Account ID', key: 'accountId', width: 16 },
  { header: 'State', key: 'state', width: 18 },
  { header: 'Maturity Date', key: 'maturityDate', width: 14, numFmt: DATE_FMT },
  { header: 'Current', key: 'current', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: '1-30', key: 'days1to30', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: '31-60', key: 'days31to60', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: '61-90', key: 'days61to90', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: '91-120', key: 'days91to120', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: '121-150', key: 'days121to150', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: '150 Above', key: 'days150Plus', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Total', key: 'total', width: 14, numFmt: MONEY_FMT, isMoney: true },
];

export function writeAgingReportXlsx(rows: AgingReportRow[]): Promise<Buffer> {
  return writeTabularXlsx({ sheetName: 'Aging Report', columns: AGING_COLUMNS, rows, totals: { label: `Total (${rows.length} accounts)` } });
}

const ENDING_BALANCE_COLUMNS: TabularColumn<EndingBalanceReportRow>[] = [
  { header: 'Client Name', key: 'clientName', width: 28 },
  { header: 'Product', key: 'product', width: 16 },
  { header: 'Loan Account ID', key: 'loanAccountId', width: 18 },
  { header: 'Loan Amount', key: 'loanAmount', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Principal Balance', key: 'principalBalance', width: 16, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Interest Balance', key: 'interestBalance', width: 16, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Fees Balance', key: 'feesBalance', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Total Obligation', key: 'totalObligation', width: 16, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Maturity Date', key: 'maturityDate', width: 14, numFmt: DATE_FMT },
  { header: 'Term Rate', key: 'termRate', width: 12 },
  { header: 'Interest Rate', key: 'interestRate', width: 12 },
  { header: 'Account State', key: 'accountState', width: 18 },
];

export function writeEndingBalanceReportXlsx(rows: EndingBalanceReportRow[]): Promise<Buffer> {
  return writeTabularXlsx({
    sheetName: 'Ending Current Balance',
    columns: ENDING_BALANCE_COLUMNS,
    rows,
    totals: { label: `Total (${rows.length} accounts)` },
  });
}

const ACCOUNTS_PAST_DUE_COLUMNS: TabularColumn<AccountsWithPastDueReportRow>[] = [
  { header: 'Client Name', key: 'clientName', width: 28 },
  { header: 'Product', key: 'product', width: 16 },
  { header: 'Account ID', key: 'accountId', width: 16 },
  { header: 'Account State', key: 'accountState', width: 18 },
  { header: 'Due Date', key: 'dueDate', width: 14, numFmt: DATE_FMT },
  { header: 'Maturity Date', key: 'maturityDate', width: 14, numFmt: DATE_FMT },
  { header: 'Last Paid Date', key: 'lastPaidDate', width: 14, numFmt: DATE_FMT },
  { header: 'Current Amount Due', key: 'currentAmountDue', width: 16, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Past Amount Due', key: 'pastAmountDue', width: 16, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Days Late', key: 'daysLate', width: 10 },
  { header: 'Repayment', key: 'repayment', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Lack / Excess', key: 'lackOrExcess', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Repayment State', key: 'repaymentState', width: 16 },
  { header: 'Count of Payed Due', key: 'countOfPaidDue', width: 14 },
];

export function writeAccountsWithPastDueReportXlsx(rows: AccountsWithPastDueReportRow[]): Promise<Buffer> {
  return writeTabularXlsx({
    sheetName: 'Accounts with Past Due',
    columns: ACCOUNTS_PAST_DUE_COLUMNS,
    rows,
    totals: { label: `Total (${rows.length} accounts)` },
  });
}

const COLLECTION_HISTORY_COLUMNS: TabularColumn<CollectionHistoryReportRow>[] = [
  { header: 'Client Name', key: 'clientName', width: 28 },
  { header: 'Product', key: 'product', width: 16 },
  { header: 'Account ID', key: 'accountId', width: 16 },
  { header: 'Due Date', key: 'dueDate', width: 14, numFmt: DATE_FMT },
  { header: 'Maturity Date', key: 'maturityDate', width: 14, numFmt: DATE_FMT },
  { header: 'Last Paid Date', key: 'lastPaidDate', width: 14, numFmt: DATE_FMT },
  { header: 'Amount Due', key: 'amountDue', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Repayment', key: 'repayment', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Lack / Excess', key: 'lackOrExcess', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Repayment State', key: 'repaymentState', width: 16 },
  { header: 'Repayment Count', key: 'repaymentCount', width: 14 },
  { header: 'Number of This Due in Repayment', key: 'installmentNumber', width: 20 },
];

export function writeCollectionHistoryReportXlsx(rows: CollectionHistoryReportRow[]): Promise<Buffer> {
  return writeTabularXlsx({
    sheetName: 'Collection',
    columns: COLLECTION_HISTORY_COLUMNS,
    rows,
    totals: { label: `Total (${rows.length} installments)` },
  });
}

const EXPECTED_COLLECTION_COLUMNS: TabularColumn<ExpectedCollectionReportRow>[] = [
  { header: 'Client Name', key: 'clientName', width: 28 },
  { header: 'Product', key: 'product', width: 16 },
  { header: 'ID', key: 'accountId', width: 16 },
  { header: 'Mobile Number', key: 'mobileNumber', width: 16 },
  { header: 'Account State', key: 'accountState', width: 18 },
  { header: 'Due Date', key: 'dueDate', width: 14, numFmt: DATE_FMT },
  { header: 'Maturity Date', key: 'maturityDate', width: 14, numFmt: DATE_FMT },
  { header: 'Last Paid Date', key: 'lastPaidDate', width: 14, numFmt: DATE_FMT },
  { header: 'Principal Due', key: 'principalDue', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Interest Due', key: 'interestDue', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Principal Paid', key: 'principalPaid', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Interest Paid', key: 'interestPaid', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Month Due', key: 'monthDue', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Past Due Amount', key: 'pastDueAmount', width: 16, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Days Late', key: 'daysLate', width: 10 },
  { header: 'Repayment', key: 'repayment', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'State', key: 'state', width: 14 },
];

export function writeExpectedCollectionReportXlsx(rows: ExpectedCollectionReportRow[]): Promise<Buffer> {
  return writeTabularXlsx({
    sheetName: 'Expected Collection',
    columns: EXPECTED_COLLECTION_COLUMNS,
    rows,
    totals: { label: `Total (${rows.length} installments)` },
  });
}

const FIRST_AMORTIZATION_COLUMNS: TabularColumn<FirstAmortizationReportRow>[] = [
  { header: 'Client Name', key: 'clientName', width: 28 },
  { header: 'Product', key: 'product', width: 16 },
  { header: 'ID', key: 'accountId', width: 16 },
  { header: 'Account State', key: 'accountState', width: 18 },
  { header: 'First Amortization Date', key: 'firstAmortizationDate', width: 18, numFmt: DATE_FMT },
  { header: 'Principal Due', key: 'principalDue', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Interest Due', key: 'interestDue', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Fees Due', key: 'feesDue', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Penalty Due', key: 'penaltyDue', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Obligation', key: 'obligation', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Payment', key: 'payment', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Last Date Paid', key: 'lastDatePaid', width: 14, numFmt: DATE_FMT },
  { header: 'Repayment State', key: 'repaymentState', width: 16 },
];

export function writeFirstAmortizationReportXlsx(rows: FirstAmortizationReportRow[]): Promise<Buffer> {
  return writeTabularXlsx({
    sheetName: 'First Amortization',
    columns: FIRST_AMORTIZATION_COLUMNS,
    rows,
    totals: { label: `Total (${rows.length} accounts)` },
  });
}

const DAILY_COLLECTION_COLUMNS: TabularColumn<DailyCollectionReportRow>[] = [
  { header: 'Full Name (Client)', key: 'fullName', width: 28 },
  { header: 'Product ID', key: 'productId', width: 14 },
  { header: 'Account ID', key: 'accountId', width: 16 },
  { header: 'Total Balance', key: 'totalBalance', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Amount', key: 'amount', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Principal Amount', key: 'principalAmount', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Interest Amount', key: 'interestAmount', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Fees Amount', key: 'feesAmount', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Penalty Amount', key: 'penaltyAmount', width: 12, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Expected Maturity Date', key: 'expectedMaturityDate', width: 18, numFmt: DATE_FMT },
  { header: 'Value Date (Entry Date)', key: 'valueDate', width: 18, numFmt: DATE_FMT },
  { header: 'OR Number', key: 'orNumber', width: 12 },
  { header: 'AR Number', key: 'arNumber', width: 12 },
  { header: 'Channel', key: 'channel', width: 16 },
  { header: 'Type', key: 'type', width: 14 },
];

export function writeDailyCollectionReportXlsx(rows: DailyCollectionReportRow[]): Promise<Buffer> {
  return writeTabularXlsx({
    sheetName: 'Daily Collection Report',
    columns: DAILY_COLLECTION_COLUMNS,
    rows,
    totals: { label: `Total (${rows.length} transactions)` },
  });
}

const FULLY_PAID_COLUMNS: TabularColumn<FullyPaidAccountsReportRow>[] = [
  { header: 'Client Name', key: 'clientName', width: 28 },
  { header: 'Product', key: 'product', width: 16 },
  { header: 'Product ID', key: 'productId', width: 14 },
  { header: 'ID', key: 'accountId', width: 16 },
  { header: 'Loan Amount', key: 'loanAmount', width: 14, numFmt: MONEY_FMT, isMoney: true },
  { header: 'Maturity Date', key: 'maturityDate', width: 14, numFmt: DATE_FMT },
  { header: 'Fully Paid Date', key: 'fullyPaidDate', width: 14, numFmt: DATE_FMT },
];

export function writeFullyPaidAccountsReportXlsx(rows: FullyPaidAccountsReportRow[]): Promise<Buffer> {
  return writeTabularXlsx({
    sheetName: 'Fully Paid Accounts',
    columns: FULLY_PAID_COLUMNS,
    rows,
    totals: { label: `Total (${rows.length} accounts)` },
  });
}

/** 2026-08-22 (user request) - net-new report, no legacy `.xlsx` sample to match column-for-column. */
const PORTAL_ACCOUNTS_COLUMNS: TabularColumn<PortalAccountReportRow>[] = [
  { header: 'Name', key: 'name', width: 28 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Contact Number', key: 'contactNumber', width: 16 },
  { header: 'Status', key: 'status', width: 18 },
  { header: 'Linked Client', key: 'linkedTo', width: 24 },
  { header: 'Email Verified', key: 'emailVerifiedAt', width: 14, numFmt: DATE_FMT },
  { header: 'Created', key: 'createdAt', width: 14, numFmt: DATE_FMT },
];

export function writePortalAccountsReportXlsx(rows: PortalAccountReportRow[]): Promise<Buffer> {
  return writeTabularXlsx({
    sheetName: 'Portal Accounts',
    columns: PORTAL_ACCOUNTS_COLUMNS,
    rows,
    totals: { label: `Total (${rows.length} accounts)` },
  });
}
