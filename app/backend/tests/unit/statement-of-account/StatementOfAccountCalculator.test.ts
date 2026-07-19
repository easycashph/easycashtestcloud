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
 * Formulas sourced from the user's own legacy Excel/VBA tool (full source shared 2026-07-19) — see
 * `StatementOfAccountCalculator`'s own doc comment for the full citation. In particular the Penalty
 * formula here is the legacy tool's flat 10%/month linear formula (confirmed 2026-07-19), NOT the
 * system's own ADR-050 compounding/size-tiered/grace-period formula used elsewhere (e.g. Loan
 * Detail's live penalty) — a deliberate, confirmed difference specific to this document.
 */
describe('StatementOfAccountCalculator (ADR-052)', () => {
  it('counts Past Due Principal/Interest/Penalty for an installment due on/before penaltyAsOfDate', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), new Date(), new Date());

    expect(figures.pastDuePrincipal.toString()).toBe('1000.00');
    expect(figures.pastDueInterest.toString()).toBe('100.00');
    // Penalty = unpaidBase(1100.00) x daysLate(40) x (10% / 30) = 146.67
    expect(figures.pastDuePenalty.toString()).toBe('146.67');
    expect(figures.totalPastDue.toString()).toBe('1246.67');
  });

  it('excludes an installment due AFTER penaltyAsOfDate from Past Due entirely', () => {
    const inst1 = installment(1, daysFromNow(10), { principal: '1000.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), new Date(), new Date());

    expect(figures.pastDuePrincipal.toString()).toBe('0.00');
    expect(figures.pastDueInterest.toString()).toBe('0.00');
    expect(figures.pastDuePenalty.toString()).toBe('0.00');
  });

  it('excludes an installment already fully settled as of penaltyAsOfDate, even if its due date has passed', () => {
    const inst1 = installment(1, daysAgo(10), { principal: '1000.00', interest: '100.00' }, { principal: '1000.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), new Date(), new Date());

    expect(figures.pastDuePrincipal.toString()).toBe('0.00');
    expect(figures.pastDueInterest.toString()).toBe('0.00');
    expect(figures.pastDuePenalty.toString()).toBe('0.00');
    expect(figures.remainingSchedule).toHaveLength(0);
  });

  it('Current Amortization Due is the next unpaid installment due AFTER penaltyAsOfDate', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' });
    const inst2 = installment(2, daysFromNow(10), { principal: '800.00', interest: '80.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1, inst2], Percentage.of('3'), new Date(), new Date());

    expect(figures.currentAmortizationDue.toString()).toBe('880.00');
  });

  it('Current Amortization Due is zero when every installment is due on/before penaltyAsOfDate', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), new Date(), new Date());

    expect(figures.currentAmortizationDue.toString()).toBe('0.00');
  });

  it('computes Accrued Interest as (Total Past Due x Contractual Rate) / 30 x Days Late (Maturity -> accruedInterestAsOfDate)', () => {
    const inst1 = installment(1, daysAgo(15), { principal: '900.00', interest: '100.00' });
    const penaltyAsOfDate = new Date(); // 15 days late -> penalty = 1000 x 15 x (0.1/30) = 50.00
    const accruedInterestAsOfDate = daysFromNow(25); // 40 days after the maturity date (daysAgo(15))
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), penaltyAsOfDate, accruedInterestAsOfDate);

    expect(figures.totalPastDue.toString()).toBe('1050.00');
    // 1050.00 x 3% / 30 x 40 days = 42.00
    expect(figures.accruedInterest.toString()).toBe('42.00');
  });

  it('clamps Accrued Interest to 0 when accruedInterestAsOfDate has not yet reached the Maturity Date', () => {
    const inst1 = installment(1, daysAgo(15), { principal: '900.00', interest: '100.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), new Date(), daysAgo(20));

    expect(figures.accruedInterest.toString()).toBe('0.00');
  });

  it('penaltyAsOfDate and accruedInterestAsOfDate are independent, manually-entered dates', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '10000.00', interest: '1000.00' });
    const accruedInterestAsOfDate = daysAgo(35); // fixed for both cases below

    const figuresEarlyPenalty = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), daysAgo(35), accruedInterestAsOfDate);
    const figuresLatePenalty = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), daysAgo(1), accruedInterestAsOfDate);

    expect(figuresLatePenalty.pastDuePenalty.greaterThan(figuresEarlyPenalty.pastDuePenalty)).toBe(true);
    // Accrued Interest depends on totalPastDue (larger once penaltyAsOfDate is pushed later) even
    // though accruedInterestAsOfDate itself didn't change - confirms the two dates feed different
    // steps of the same calculation without being conflated into one shared date.
    expect(figuresLatePenalty.accruedInterest.toString()).not.toBe(figuresEarlyPenalty.accruedInterest.toString());
  });

  it('accounts for partial payments when computing past-due principal/interest', () => {
    const inst1 = installment(1, daysAgo(10), { principal: '1000.00', interest: '100.00' }, { principal: '400.00', interest: '50.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1], Percentage.of('3'), new Date(), new Date());

    expect(figures.pastDuePrincipal.toString()).toBe('600.00');
    expect(figures.pastDueInterest.toString()).toBe('50.00');
  });

  it('Remaining Amortization lists every installment with a positive balance, regardless of date', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' }, { principal: '1000.00', interest: '100.00' });
    const inst2 = installment(2, daysFromNow(10), { principal: '800.00', interest: '80.00' });
    const figures = StatementOfAccountCalculator.calculate([inst1, inst2], Percentage.of('3'), new Date(), new Date());

    expect(figures.remainingSchedule).toHaveLength(1);
    expect(figures.remainingSchedule[0]?.totalDue.toString()).toBe('880.00');
  });
});
