import ExcelJs from 'exceljs';
import type { CicMonthlyReportData } from '../application/ports/IReportingRepository';
import { manilaExcelDisplayDate } from '../../../shared/domain/manilaTime';
import { cicOverdueDaysCode } from './CicCsdfReportWriter';

/** See `manilaExcelDisplayDate`'s own doc comment - ExcelJS reads a JS Date's UTC Y/M/D straight
 * through as the displayed calendar date, so every date cell in this workbook needs this same
 * Manila-timezone correction (2026-09-07, same root cause as ExcelJsLoanReleasesReportWriter's
 * fix) - doubly important here since this is a regulatory CIC submission companion, not just an
 * internal report. */
function d(value: Date | null): Date | null {
  return value ? manilaExcelDisplayDate(value) : null;
}

const ID_COLUMNS: { header: string; width: number }[] = [
  { header: 'Provider Subject No', width: 22 },
  { header: 'Title', width: 8 },
  { header: 'First Name', width: 18 },
  { header: 'Last Name', width: 18 },
  { header: 'Middle Name', width: 18 },
  { header: 'Suffix', width: 8 },
  { header: 'Gender', width: 8 },
  { header: 'Birth Date', width: 14 },
  { header: 'Nationality', width: 12 },
  { header: 'Mobile', width: 16 },
  { header: 'Email', width: 26 },
  { header: 'Employer Name', width: 26 },
  { header: 'Civil Status Code', width: 12 },
  { header: 'TIN', width: 16 },
  { header: 'SSS', width: 16 },
  { header: 'ID Type Code (photo ID)', width: 16 },
  { header: 'ID Number (photo ID)', width: 20 },
  { header: 'Occupation Status Code', width: 14 },
  { header: 'Gross Income', width: 14 },
  { header: 'Address 1 (Permanent)', width: 40 },
  { header: 'Address 1 Street No', width: 20 },
  { header: 'Address 1 Barangay', width: 18 },
  { header: 'Address 1 City', width: 18 },
  { header: 'Address 1 Province', width: 18 },
  { header: 'Address 1 Postal Code', width: 12 },
  { header: 'Address 2 (Present/Mailing)', width: 40 },
  { header: 'Address 2 Street No', width: 20 },
  { header: 'Address 2 Barangay', width: 18 },
  { header: 'Address 2 City', width: 18 },
  { header: 'Address 2 Province', width: 18 },
  { header: 'Address 2 Postal Code', width: 12 },
];

const CI_COLUMNS: { header: string; width: number }[] = [
  { header: 'Provider Subject No', width: 22 },
  { header: 'Provider Contract No', width: 22 },
  { header: 'Loan Code (internal)', width: 18 },
  { header: 'Contract Type Code', width: 12 },
  { header: 'Purpose of Credit Code', width: 12 },
  { header: 'Contract Phase', width: 10 },
  { header: 'Contract Status', width: 12 },
  { header: 'Contract Start Date', width: 16 },
  { header: 'Contract Request Date', width: 16 },
  { header: 'Contract End Planned Date', width: 18 },
  { header: 'Contract End Actual Date', width: 18 },
  { header: 'Financed Amount', width: 16 },
  { header: 'Installments Number', width: 14 },
  { header: 'Monthly Payment Amount', width: 16 },
  { header: 'First Payment Date', width: 16 },
  { header: 'Last Payment Date', width: 16 },
  { header: 'Last Payment Amount', width: 16 },
  { header: 'Next Payment Date', width: 16 },
  { header: 'Next Payment Amount', width: 16 },
  { header: 'Outstanding Payments Number', width: 16 },
  { header: 'Outstanding Balance', width: 16 },
  { header: 'Overdue Payments Number', width: 14 },
  { header: 'Overdue Payments Amount', width: 16 },
  { header: 'Overdue Days (CIC code)', width: 14 },
  { header: 'Overdue Days (actual)', width: 14 },
];

function styleHeaderRow(sheet: ExcelJs.Worksheet): void {
  const row = sheet.getRow(1);
  row.font = { bold: true };
  row.alignment = { wrapText: true, vertical: 'middle' };
}

/**
 * Staff-review workbook for the CIC monthly report (2026-08-30, user request) - a human-readable
 * companion to `CicCsdfReportWriter`'s actual pipe-delimited submission file, NOT a substitute for
 * it. Column headers are plain English (not the raw CSDF field codes) so staff can review/QA the
 * data before generating and submitting the real file. Blank cells mean the same thing they mean in
 * the CSDF output: no confirmed value for that field (never fabricated - see
 * `IReportingRepository.CicIndividualRow`/`CicContractRow`'s own doc comments for exactly which
 * fields are still unmapped and why).
 */
export class CicExcelReportWriter {
  async write(data: CicMonthlyReportData): Promise<Buffer> {
    const workbook = new ExcelJs.Workbook();
    workbook.creator = 'Easycash LMS';
    workbook.created = new Date();

    const idSheet = workbook.addWorksheet('ID - Individual');
    idSheet.columns = ID_COLUMNS.map((c) => ({ header: c.header, width: c.width }));
    styleHeaderRow(idSheet);
    for (const person of data.individuals) {
      idSheet.addRow([
        person.providerSubjectNo,
        person.title,
        person.firstName,
        person.lastName,
        person.middleName,
        person.suffix,
        person.gender,
        d(person.birthDate),
        person.nationality,
        person.mobile,
        person.email,
        person.employerName,
        person.civilStatusCode,
        person.tin,
        person.sss,
        person.idTypeCode,
        person.idNumber,
        person.occupationStatusCode,
        person.grossIncome ? Number(person.grossIncome) : '',
        person.addressFullAddress,
        person.addressStreetNo,
        person.addressBarangay,
        person.addressCity,
        person.addressProvince,
        person.addressPostalCode,
        person.address2FullAddress,
        person.address2StreetNo,
        person.address2Barangay,
        person.address2City,
        person.address2Province,
        person.address2PostalCode,
      ]);
    }
    idSheet.getColumn(8).numFmt = 'mm/dd/yyyy';
    idSheet.getColumn(19).numFmt = '#,##0';

    const ciSheet = workbook.addWorksheet('CI - Installment Contract');
    ciSheet.columns = CI_COLUMNS.map((c) => ({ header: c.header, width: c.width }));
    styleHeaderRow(ciSheet);
    for (const contract of data.contracts) {
      ciSheet.addRow([
        contract.providerSubjectNo,
        contract.providerContractNo,
        contract.loanCode,
        contract.contractTypeCode,
        contract.purposeOfCreditCode,
        contract.contractPhase,
        contract.contractStatus,
        d(contract.contractStartDate),
        d(contract.contractRequestDate),
        d(contract.contractEndPlannedDate),
        d(contract.contractEndActualDate),
        Number(contract.financedAmount),
        contract.installmentsNumber,
        Number(contract.monthlyPaymentAmount),
        d(contract.firstPaymentDate),
        d(contract.lastPaymentDate),
        Number(contract.lastPaymentAmount),
        d(contract.nextPaymentDate),
        Number(contract.nextPaymentAmount),
        contract.outstandingPaymentsNumber,
        Number(contract.outstandingBalance),
        contract.overduePaymentsNumber,
        Number(contract.overduePaymentsAmount),
        // 2026-09-07 (full-audit fix, user request "ayusin mo rin ang Excel para tumugma sa CSV"):
        // this used to be just the raw day count, which doesn't match what actually goes into the
        // real CSDF submission (a coded bucket, see `cicOverdueDaysCode`'s own doc comment) - a
        // staff member reviewing this file before submission would see e.g. "2376" here but "6" in
        // the real file, with no way to tell from this sheet alone whether that's correct. Now
        // shows both: the CIC code (what's actually submitted) and the raw days (human context).
        cicOverdueDaysCode(contract.overdueDays),
        contract.overdueDays,
      ]);
    }
    for (const col of [8, 9, 10, 11, 15, 16, 18]) ciSheet.getColumn(col).numFmt = 'mm/dd/yyyy';
    for (const col of [12, 14, 17, 19, 21, 23]) ciSheet.getColumn(col).numFmt = '#,##0.00';

    if (data.skippedMissingSubjectNo.length > 0) {
      const skippedSheet = workbook.addWorksheet('Excluded (missing CIC ID)');
      skippedSheet.columns = [
        { header: 'Loan Code', width: 18 },
        { header: 'Borrower', width: 26 },
        { header: 'Reason', width: 28 },
      ];
      styleHeaderRow(skippedSheet);
      for (const row of data.skippedMissingSubjectNo) {
        skippedSheet.addRow([
          row.loanCode,
          row.borrowerName,
          row.reason === 'MISSING_SUBJECT_NO' ? 'Borrower missing permanent CIC ID' : 'Loan missing permanent CIC contract ID',
        ]);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
