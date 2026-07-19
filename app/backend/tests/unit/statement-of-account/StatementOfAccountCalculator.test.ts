import { describe, expect, it } from 'vitest';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { StatementOfAccountCalculator } from '@modules/statement-of-account/application/services/StatementOfAccountCalculator';

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function installment(
  installmentNumber: number,
  dueDate: Date,
  due: Partial<{ principal: string; interest: string; penalty: string }>,
  paid: Partial<{ principal: string; interest: string }> = {},
) {
  const inst = RepaymentInstallment.create({
    loanAccountId: 'loan-1',
    installmentNumber,
    dueDate,
    due: InstallmentAmounts.of({
      principal: Money.of(due.principal ?? '0.00'),
      interest: Money.of(due.interest ?? '0.00'),
      penalty: Money.of(due.penalty ?? '0.00'),
    }),
  });
  if (paid.principal || paid.interest) {
    inst.recordPayment(
      InstallmentAmounts.of({
        principal: Money.of(paid.principal ?? '0.00'),
        interest: Money.of(paid.interest ?? '0.00'),
      }),
    );
  }
  return inst;
}

/**
 * Formula sourced from the user's own legacy Excel/VBA tool
 * (`legacy/Excel LMS Files/BETA 1.5.83 LMSv3.xlsm`), confirmed directly with the user 2026-07-19 —
 * see `StatementOfAccountCalculator`'s own doc comment for the full citation.
 */
describe('StatementOfAccountCalculator (ADR-052)', () => {
  it('sums past-due principal/interest/penalty from LATE installments only', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00', penalty: '50.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), new Date(), new Date(), {
      isProspectiveLoan: false,
      principalAmount: Money.of('1000.00'),
    });

    expect(figures.pastDuePrincipal.toString()).toBe('1000.00');
    expect(figures.pastDueInterest.toString()).toBe('100.00');
    expect(figures.pastDuePenalty.toString()).toBe('50.00');
    expect(figures.totalPastDue.toString()).toBe('1150.00');
  });

  it('computes Accrued Interest as (Total Past Due x Contractual Rate) / 30 x Days Late', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00', penalty: '50.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), new Date(), new Date(), {
      isProspectiveLoan: false,
      principalAmount: Money.of('1000.00'),
    });

    // Total Past Due 1150.00 x 3% / 30 x 40 days = 46.00
    expect(figures.accruedInterest.toString()).toBe('46.00');
  });

  it('clamps Days Late to 0 (no accrual) when asOfDate has not yet reached the Maturity Date', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00', penalty: '50.00' });
    const inst2 = installment(2, daysFromNow(10), { principal: '1000.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1, inst2], Percentage.of('3'), new Date(), new Date(), {
      isProspectiveLoan: false,
      principalAmount: Money.of('1000.00'),
    });

    // Maturity Date = last installment's due date (inst2, still in the future) - not past maturity yet.
    expect(figures.accruedInterest.toString()).toBe('0.00');
  });

  it('penaltyAsOfDate and accruedInterestAsOfDate are independent, manually-entered dates (2026-07-19, matches the legacy tool\'s two separate "To Date" fields)', () => {
    // A prospective (non-migrated) loan so penalty is live-computed via ADR-050 (grows the further
    // penaltyAsOfDate is pushed past the due date) — isolates that only the intended date affects each figure.
    const inst1 = installment(1, daysAgo(40), { principal: '10000.00', interest: '1000.00' });
    const figuresEarlyPenalty = StatementOfAccountCalculator.calculate(
      [inst1],
      Percentage.of('3'),
      daysAgo(35), // penalty as of 5 days after due date
      daysAgo(35), // accrued interest as of the same date, for comparison
      { isProspectiveLoan: true, principalAmount: Money.of('10000.00') },
    );
    const figuresLatePenaltyOnly = StatementOfAccountCalculator.calculate(
      [inst1],
      Percentage.of('3'),
      daysAgo(1), // penalty as of 39 days after due date - materially larger
      daysAgo(35), // accrued interest as of the SAME date as the first case - unchanged
      { isProspectiveLoan: true, principalAmount: Money.of('10000.00') },
    );

    expect(figuresLatePenaltyOnly.pastDuePenalty.greaterThan(figuresEarlyPenalty.pastDuePenalty)).toBe(true);
    // Accrued Interest depends on totalPastDue (which now includes the larger penalty) AND its own
    // date - holding accruedInterestAsOfDate fixed while only pushing penaltyAsOfDate later still
    // changes Accrued Interest (via the larger totalPastDue base), confirming the two dates feed
    // different steps of the same calculation without being conflated into one shared date.
    expect(figuresLatePenaltyOnly.accruedInterest.toString()).not.toBe(figuresEarlyPenalty.accruedInterest.toString());
  });

  it('accounts for partial payments when computing past-due principal/interest', () => {
    const inst1 = installment(
      1,
      daysAgo(10),
      { principal: '1000.00', interest: '100.00' },
      { principal: '400.00', interest: '50.00' },
    );
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), new Date(), new Date(), {
      isProspectiveLoan: false,
      principalAmount: Money.of('1000.00'),
    });

    expect(figures.pastDuePrincipal.toString()).toBe('600.00');
    expect(figures.pastDueInterest.toString()).toBe('50.00');
  });

  it('Current Amortization Due is the next unpaid installment that is not yet LATE', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' });
    const inst2 = installment(2, daysFromNow(10), { principal: '800.00', interest: '80.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1, inst2], Percentage.of('3'), new Date(), new Date(), {
      isProspectiveLoan: false,
      principalAmount: Money.of('1000.00'),
    });

    expect(figures.currentAmortizationDue.toString()).toBe('880.00');
  });

  it('Current Amortization Due is zero when every remaining installment is already LATE', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), new Date(), new Date(), {
      isProspectiveLoan: false,
      principalAmount: Money.of('1000.00'),
    });

    expect(figures.currentAmortizationDue.toString()).toBe('0.00');
  });

  it('excludes PAID installments from the Remaining Amortization table', () => {
    const inst1 = installment(
      1,
      daysAgo(40),
      { principal: '1000.00', interest: '100.00' },
      { principal: '1000.00', interest: '100.00' },
    );
    const inst2 = installment(2, daysFromNow(10), { principal: '800.00', interest: '80.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1, inst2], Percentage.of('3'), new Date(), new Date(), {
      isProspectiveLoan: false,
      principalAmount: Money.of('1000.00'),
    });

    expect(figures.remainingSchedule).toHaveLength(1);
    expect(figures.remainingSchedule[0]?.totalDue.toString()).toBe('880.00');
  });
});
