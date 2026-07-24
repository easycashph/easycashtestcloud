import { describe, expect, it } from 'vitest';
import { AccruedInterestCalculator } from '@modules/loan-account/application/services/AccruedInterestCalculator';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';

// Real fixture, verified against the live system (2026-07-24): a 6-installment loan, fully
// unpaid, ₱30,000 principal at 4.95%/month, matured Jul 1 2026, "as of" Jul 24 2026 (23 days late).
const DUE_DATES = ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01'].map((d) => new Date(`${d}T00:00:00.000Z`));
const PRINCIPAL_DUE = ['4416.08', '4634.68', '4864.09', '5104.87', '5357.56', '5622.72'];
const INTEREST_DUE = ['1485.00', '1266.40', '1036.99', '796.21', '543.52', '278.32'];
const AS_OF_DATE = new Date('2026-07-24T00:00:00.000Z');
const CONTRACTUAL_RATE = Percentage.of('4.95');

function buildSchedule() {
  return DUE_DATES.map((dueDate, index) =>
    RepaymentInstallment.create({
      loanAccountId: 'loan-1',
      installmentNumber: index + 1,
      dueDate,
      due: InstallmentAmounts.of({ principal: Money.of(PRINCIPAL_DUE[index]!), interest: Money.of(INTEREST_DUE[index]!) }),
    }),
  );
}

describe('AccruedInterestCalculator', () => {
  it('resolves maturityDate as the latest dueDate across the schedule', () => {
    const result = AccruedInterestCalculator.calculate(
      buildSchedule(),
      { isProspectiveLoan: true, principalAmount: Money.of('30000.00'), isSecMc3Covered: false },
      CONTRACTUAL_RATE,
      AS_OF_DATE,
    );
    expect(result.maturityDate.toISOString()).toBe(DUE_DATES[5]!.toISOString());
  });

  it('sums unpaid principal/interest across every past-due installment - matches the loan\'s own totals exactly', () => {
    const result = AccruedInterestCalculator.calculate(
      buildSchedule(),
      { isProspectiveLoan: true, principalAmount: Money.of('30000.00'), isSecMc3Covered: false },
      CONTRACTUAL_RATE,
      AS_OF_DATE,
    );
    expect(result.totalPastDuePrincipal.toString()).toBe('30000.00');
    expect(result.totalPastDueInterest.toString()).toBe('5406.44');
  });

  it('computes 23 days late (Jul 1 -> Jul 24) and the exact verified accrued interest figure', () => {
    const result = AccruedInterestCalculator.calculate(
      buildSchedule(),
      { isProspectiveLoan: true, principalAmount: Money.of('30000.00'), isSecMc3Covered: false },
      CONTRACTUAL_RATE,
      AS_OF_DATE,
    );
    expect(result.daysLate).toBe(23);
    // Verified by hand against the live system: ₱45,530.40 x 4.95% / 30 x 23 = ₱1,727.88.
    expect(result.totalPastDue.toString()).toBe('45530.40');
    expect(result.accruedInterest.toString()).toBe('1727.88');
  });

  it('is zero before the maturity date has passed, even with a large unpaid balance', () => {
    const beforeMaturity = new Date('2026-06-15T00:00:00.000Z');
    const result = AccruedInterestCalculator.calculate(
      buildSchedule(),
      { isProspectiveLoan: true, principalAmount: Money.of('30000.00'), isSecMc3Covered: false },
      CONTRACTUAL_RATE,
      beforeMaturity,
    );
    expect(result.daysLate).toBe(0);
    expect(result.accruedInterest.isZero()).toBe(true);
  });

  it('is zero when no contractual rate is set, regardless of days late', () => {
    const result = AccruedInterestCalculator.calculate(
      buildSchedule(),
      { isProspectiveLoan: true, principalAmount: Money.of('30000.00'), isSecMc3Covered: false },
      undefined,
      AS_OF_DATE,
    );
    expect(result.accruedInterest.isZero()).toBe(true);
  });

  it('excludes an installment once it is fully paid', () => {
    const schedule = buildSchedule();
    schedule[0]!.recordPayment(
      InstallmentAmounts.of({ principal: Money.of(PRINCIPAL_DUE[0]!), interest: Money.of(INTEREST_DUE[0]!) }),
      new Date('2026-02-10T00:00:00.000Z'),
    );
    const result = AccruedInterestCalculator.calculate(
      schedule,
      { isProspectiveLoan: true, principalAmount: Money.of('30000.00'), isSecMc3Covered: false },
      CONTRACTUAL_RATE,
      AS_OF_DATE,
    );
    const expectedPrincipal = PRINCIPAL_DUE.slice(1).reduce((sum, v) => sum + Number(v), 0);
    expect(Number(result.totalPastDuePrincipal.toString())).toBeCloseTo(expectedPrincipal, 2);
  });
});
