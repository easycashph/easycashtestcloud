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
  due: Partial<{ principal: string; interest: string }>,
  paid: Partial<{ principal: string; interest: string }> = {},
) {
  const inst = RepaymentInstallment.create({
    loanAccountId: 'loan-1',
    installmentNumber,
    dueDate,
    due: InstallmentAmounts.of({
      principal: Money.of(due.principal ?? '0.00'),
      interest: Money.of(due.interest ?? '0.00'),
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
 * Formulas sourced from the user's own legacy Excel/VBA tool (full source shared 2026-07-19), with
 * two deliberate departures confirmed the same day — see `StatementOfAccountCalculator`'s own doc
 * comment for the full citation:
 * - `penaltyFromDate`/`penaltyToDate` are ONE SHARED, manually-entered date range applied to every
 *   Past Due installment (not each installment's own due date, unlike the legacy tool).
 * - The 5%/10% rate is evaluated per-installment against that installment's own unpaid balance
 *   (not the whole loan's principal, unlike ADR-050's system-wide penalty formula).
 */
describe('StatementOfAccountCalculator (ADR-052)', () => {
  it('counts Past Due Principal/Interest for an installment due on/before penaltyToDate', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), daysAgo(45), new Date(), new Date());

    expect(figures.pastDuePrincipal.toString()).toBe('1000.00');
    expect(figures.pastDueInterest.toString()).toBe('100.00');
  });

  it('computes Penalty as unpaidBalance x Days(penaltyFromDate, penaltyToDate) x rate/30, using STANDARD (10%) rate above the ₱10,000 threshold', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '11000.00', interest: '0.00' }); // unpaid balance 11,000 > 10,000
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), daysAgo(30), new Date(), new Date());

    // 30 days between penaltyFromDate and penaltyToDate, applied uniformly (NOT the installment's own due date)
    // Penalty = 11000 x 30 x (10% / 30) = 1100.00
    expect(figures.pastDuePenalty.toString()).toBe('1100.00');
  });

  it('uses the SMALL BALANCE (5%) rate when the installment\'s own unpaid balance is <= ₱10,000', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '10000.00', interest: '0.00' }); // exactly at the threshold
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), daysAgo(30), new Date(), new Date());

    // Penalty = 10000 x 30 x (5% / 30) = 500.00
    expect(figures.pastDuePenalty.toString()).toBe('500.00');
  });

  it('applies the SAME penaltyFromDate/penaltyToDate range to every Past Due installment, regardless of each installment\'s own due date', () => {
    const inst1 = installment(1, daysAgo(80), { principal: '5000.00', interest: '0.00' });
    const inst2 = installment(2, daysAgo(40), { principal: '5000.00', interest: '0.00' });
    // Both installments use the same 20-day range, independent of their own (very different) due dates.
    const figures = StatementOfAccountCalculator.calculate([inst1, inst2], Percentage.of('3'), daysAgo(20), new Date(), new Date());

    // Each: 5000 x 20 x (5% / 30) = 166.67 (rounded) -> combined
    expect(figures.pastDuePenalty.toString()).toBe('333.34');
  });

  it('excludes an installment due AFTER penaltyToDate from Past Due entirely', () => {
    const inst1 = installment(1, daysFromNow(10), { principal: '1000.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), daysAgo(10), new Date(), new Date());

    expect(figures.pastDuePrincipal.toString()).toBe('0.00');
    expect(figures.pastDuePenalty.toString()).toBe('0.00');
  });

  it('excludes an installment already fully settled as of penaltyToDate, even if its due date has passed', () => {
    const inst1 = installment(1, daysAgo(10), { principal: '1000.00', interest: '100.00' }, { principal: '1000.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), daysAgo(5), new Date(), new Date());

    expect(figures.pastDuePrincipal.toString()).toBe('0.00');
    expect(figures.pastDuePenalty.toString()).toBe('0.00');
    expect(figures.remainingSchedule).toHaveLength(0);
  });

  it('Current Amortization Due is the next unpaid installment due AFTER penaltyToDate', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' });
    const inst2 = installment(2, daysFromNow(10), { principal: '800.00', interest: '80.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1, inst2], Percentage.of('3'), daysAgo(40), new Date(), new Date());

    expect(figures.currentAmortizationDue.toString()).toBe('880.00');
  });

  it('computes Accrued Interest as (Total Past Due x Contractual Rate) / 30 x Days Late (Maturity -> accruedInterestAsOfDate)', () => {
    const inst1 = installment(1, daysAgo(15), { principal: '900.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), daysAgo(15), new Date(), daysFromNow(25));

    // Past Due base 1000.00, 15 days at 5% (balance <= 10,000): penalty = 1000 x 15 x (5%/30) = 25.00
    expect(figures.totalPastDue.toString()).toBe('1025.00');
    // 1025.00 x 3% / 30 x 40 days (accrued range, independent of the penalty range) = 41.00
    expect(figures.accruedInterest.toString()).toBe('41.00');
  });

  it('clamps Accrued Interest to 0 when accruedInterestAsOfDate has not yet reached the Maturity Date', () => {
    const inst1 = installment(1, daysAgo(15), { principal: '900.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), daysAgo(15), new Date(), daysAgo(20));

    expect(figures.accruedInterest.toString()).toBe('0.00');
  });

  it('accounts for partial payments when computing past-due principal/interest', () => {
    const inst1 = installment(1, daysAgo(10), { principal: '1000.00', interest: '100.00' }, { principal: '400.00', interest: '50.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), daysAgo(10), new Date(), new Date());

    expect(figures.pastDuePrincipal.toString()).toBe('600.00');
    expect(figures.pastDueInterest.toString()).toBe('50.00');
  });

  it('Remaining Amortization lists every installment with a positive balance, regardless of date', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' }, { principal: '1000.00', interest: '100.00' });
    const inst2 = installment(2, daysFromNow(10), { principal: '800.00', interest: '80.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1, inst2], Percentage.of('3'), daysAgo(40), new Date(), new Date());

    expect(figures.remainingSchedule).toHaveLength(1);
    expect(figures.remainingSchedule[0]?.totalDue.toString()).toBe('880.00');
  });
});
