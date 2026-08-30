import type { CicMonthlyReportData } from '../application/ports/IReportingRepository';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Easycash's real CIC provider code, confirmed from every historical submission on file
 * (`legacy/CIC /*\/PF017290_CSDF_*.csv`) - not a guess. */
const PROVIDER_CODE = 'PF017290';

// Field counts match the real accepted submissions exactly (verified 2026-08-30 against
// `PF017290_CSDF_20260811105959.csv`) - CIC's own template technically defines more optional
// trailing columns (guarantor/asset/linked-subject blocks for CI, sole-trader blocks for ID) that
// this company's real submissions simply never populate, so this writer doesn't emit them either.
const ID_FIELD_COUNT = 92;
const CI_FIELD_COUNT = 92;

/** Stored dates are UTC instants (often midnight UTC for a "calendar date" field, e.g. birthDate) -
 * rendering with plain getUTCDate() reads a Manila-local date as the PREVIOUS day (verified: a real
 * borrower's birthDate 1993-09-10T16:00Z is Sept 11 in Manila, and the real CIC submission on file
 * for that exact person has DOB "11091993" - Sept 11, not the 10th). `manilaCalendarDay` is this
 * codebase's existing fix for that same class of bug elsewhere (SOA/schedule dates). */
function ddmmyyyy(date: Date | null): string {
  if (!date) return '';
  // Re-base the instant so its UTC fields read as the Asia/Manila wall-clock date, same technique
  // as this codebase's own (private) `manilaWallClock` helper in shared/domain/manilaTime.ts.
  const manila = new Date(date.getTime() + MANILA_OFFSET_MS);
  const dd = String(manila.getUTCDate()).padStart(2, '0');
  const mm = String(manila.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = manila.getUTCFullYear();
  return `${dd}${mm}${yyyy}`;
}

/** Builds a fixed-length field array, fills known positions, leaves the rest blank, then trims
 * trailing blanks before joining - matching how the real files are actually shaped (see field
 * count comment above; a fully blank tail is simply omitted rather than padded out). */
function buildLine(length: number, known: Record<number, string>): string {
  const fields = new Array<string>(length).fill('');
  for (const [index, value] of Object.entries(known)) fields[Number(index)] = value;
  let lastNonBlank = -1;
  for (let i = 0; i < fields.length; i++) if (fields[i] !== '') lastNonBlank = i;
  return fields.slice(0, lastNonBlank + 1).join('|');
}

export class CicCsdfReportWriter {
  write(data: CicMonthlyReportData): string {
    const lines: string[] = [];

    lines.push(
      ['HD', PROVIDER_CODE, ddmmyyyy(data.referenceDate), 'v1.0', '0', `ECLC ${data.referenceDate.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${data.referenceDate.getUTCFullYear()}`].join('|'),
    );

    for (const person of data.individuals) {
      lines.push(
        buildLine(ID_FIELD_COUNT, {
          0: 'ID',
          1: PROVIDER_CODE,
          3: ddmmyyyy(data.referenceDate),
          4: person.providerSubjectNo,
          5: person.title,
          6: person.firstName,
          7: person.lastName,
          8: person.middleName,
          9: person.suffix,
          12: person.gender,
          13: ddmmyyyy(person.birthDate),
          15: 'PH',
          16: person.nationality || 'PH',
          17: '1',
          18: person.civilStatusCode,
          // Address 1 (mandatory per the manual's own Individuals summary - Address Type,
          // FullAddress, StreetNo, City, Province). "MI" = Individual Main Address
          // (Residence/Permanent) - the only address type this system captures.
          31: person.addressFullAddress ? 'MI' : '',
          32: person.addressFullAddress,
          33: person.addressStreetNo,
          34: person.addressPostalCode,
          36: person.addressBarangay,
          37: person.addressCity,
          38: person.addressProvince,
          39: person.addressFullAddress ? 'PH' : '',
          // "Identification N" (TIN=10/SSS=11, structured `BorrowerGovernmentId` fields - the
          // manual's own mandatory "at least one of TIN/SSS/GSIS" rule) and "ID N" (government
          // photo ID, non-mandatory, from free-text `IdentificationDocument.documentType`) are two
          // different field groups in the CSDF layout.
          53: person.tin ? '10' : '',
          54: person.tin,
          55: person.sss ? '11' : '',
          56: person.sss,
          59: person.idTypeCode,
          60: person.idTypeCode ? person.idNumber : '',
          77: person.mobile ? '3' : '',
          78: person.mobile,
          79: person.email ? '7' : '',
          80: person.email,
          81: person.employerName,
          86: 'M',
          87: 'PHP',
          88: person.occupationStatusCode,
        }),
      );
    }

    for (const contract of data.contracts) {
      lines.push(
        buildLine(CI_FIELD_COUNT, {
          0: 'CI',
          1: PROVIDER_CODE,
          3: ddmmyyyy(data.referenceDate),
          4: contract.providerSubjectNo,
          5: 'B',
          6: contract.providerContractNo,
          7: contract.contractTypeCode,
          8: contract.contractPhase,
          10: 'PHP',
          11: 'PHP',
          12: ddmmyyyy(contract.contractStartDate),
          13: ddmmyyyy(contract.contractRequestDate),
          14: ddmmyyyy(contract.contractEndPlannedDate),
          15: ddmmyyyy(contract.contractEndActualDate),
          16: ddmmyyyy(contract.lastPaymentDate),
          19: contract.financedAmount,
          20: String(contract.installmentsNumber),
          22: contract.purposeOfCreditCode,
          23: 'M',
          25: contract.monthlyPaymentAmount,
          26: ddmmyyyy(contract.firstPaymentDate),
          27: contract.lastPaymentAmount,
          28: ddmmyyyy(contract.nextPaymentDate),
          29: contract.nextPaymentAmount,
          30: String(contract.outstandingPaymentsNumber),
          31: contract.outstandingBalance,
          32: String(contract.overduePaymentsNumber),
          33: contract.overduePaymentsAmount,
          34: String(contract.overdueDays),
        }),
      );
    }

    return lines.join('\r\n') + '\r\n';
  }
}
