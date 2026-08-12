import { describe, expect, it } from 'vitest';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import type { PenaltyComputationContext } from '@modules/repayment/domain/CurrentPenaltyResolver';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { StatementOfAccountCalculator } from '@modules/statement-of-account/application/services/StatementOfAccountCalculator';
import type { SoaPenaltyMode } from '@modules/statement-of-account/domain/GeneratedStatementOfAccount';

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
      // A migrated loan's real historical penalty, as carried over from SDevTech.
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

/** A migrated loan: `resolveComputedPenalty` returns its frozen `due.penalty`, never a live figure. */
function migratedContext(maturityDate: Date): PenaltyComputationContext {
  return { isProspectiveLoan: false, principalAmount: Money.of('50000.00'), isSecMc3Covered: false, maturityDate };
}

/** A loan originated here: `resolveComputedPenalty` computes the live ADR-050 figure. */
function prospectiveContext(maturityDate: Date, principalAmount = '30000.00'): PenaltyComputationContext {
  return { isProspectiveLoan: true, principalAmount: Money.of(principalAmount), isSecMc3Covered: false, maturityDate };
}

function calc(args: {
  installments: RepaymentInstallment[];
  contractualRate?: Percentage | undefined;
  penaltyMode?: SoaPenaltyMode;
  penaltyFromDate?: Date;
  penaltyToDate?: Date;
  accruedInterestAsOfDate?: Date;
  penaltyContext?: PenaltyComputationContext;
}) {
  const sorted = [...args.installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const impliedMaturity = sorted[sorted.length - 1]?.dueDate ?? new Date();
  return StatementOfAccountCalculator.calculate({
    installments: args.installments,
    contractualRate: args.contractualRate,
    penaltyMode: args.penaltyMode ?? 'COMPUTED',
    penaltyFromDate: args.penaltyFromDate,
    penaltyToDate: args.penaltyToDate ?? new Date(),
    accruedInterestAsOfDate: args.accruedInterestAsOfDate ?? new Date(),
    penaltyContext: args.penaltyContext ?? migratedContext(impliedMaturity),
  });
}

/**
 * 2026-08-12 (user-confirmed) — the shared-date-range penalty formula these tests used to assert was
 * replaced by two explicit modes. See `StatementOfAccountCalculator`'s own doc comment; the short
 * version is that `RECORDED` (the default) takes each installment's penalty straight off the
 * repayment schedule, and `COMPUTED` fills in ONLY the installments that have none, counting each
 * from its own due date and never past the loan's maturity date.
 */
describe('StatementOfAccountCalculator (ADR-052)', () => {
  it('counts Past Due Principal/Interest for an installment due on/before the as-of date', () => {
    const inst1 = installment(1, daysAgo(45), { principal: '1000.00', interest: '100.00' });
    const figures = calc({ installments: [inst1], contractualRate: Percentage.of('3'), penaltyFromDate: daysAgo(45) });

    expect(figures.pastDuePrincipal.toString()).toBe('1000.00');
    expect(figures.pastDueInterest.toString()).toBe('100.00');
  });

  it('excludes an installment due AFTER the as-of date from Past Due entirely', () => {
    const inst1 = installment(1, daysFromNow(10), { principal: '1000.00', interest: '100.00' });
    const figures = calc({ installments: [inst1], contractualRate: Percentage.of('3'), penaltyFromDate: daysAgo(10) });

    expect(figures.pastDuePrincipal.toString()).toBe('0.00');
    expect(figures.pastDuePenalty.toString()).toBe('0.00');
  });

  it('excludes an installment already fully settled as of that date, even if its due date has passed', () => {
    const inst1 = installment(1, daysAgo(10), { principal: '1000.00', interest: '100.00' }, { principal: '1000.00', interest: '100.00' });
    const figures = calc({ installments: [inst1], contractualRate: Percentage.of('3'), penaltyFromDate: daysAgo(5) });

    expect(figures.pastDuePrincipal.toString()).toBe('0.00');
    expect(figures.pastDuePenalty.toString()).toBe('0.00');
    expect(figures.remainingSchedule).toHaveLength(0);
  });

  it('Current Amortization Due is the next unpaid installment due AFTER the as-of date', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' });
    const inst2 = installment(2, daysFromNow(10), { principal: '800.00', interest: '80.00' });
    const figures = calc({ installments: [inst1, inst2], contractualRate: Percentage.of('3'), penaltyFromDate: daysAgo(40) });

    expect(figures.currentAmortizationDue.toString()).toBe('880.00');
  });

  it('accounts for partial payments when computing past-due principal/interest', () => {
    const inst1 = installment(1, daysAgo(10), { principal: '1000.00', interest: '100.00' }, { principal: '400.00', interest: '50.00' });
    const figures = calc({ installments: [inst1], contractualRate: Percentage.of('3'), penaltyFromDate: daysAgo(10) });

    expect(figures.pastDuePrincipal.toString()).toBe('600.00');
    expect(figures.pastDueInterest.toString()).toBe('50.00');
  });

  it('Remaining Amortization lists every installment with a positive balance, regardless of date', () => {
    const inst1 = installment(1, daysAgo(40), { principal: '1000.00', interest: '100.00' }, { principal: '1000.00', interest: '100.00' });
    const inst2 = installment(2, daysFromNow(10), { principal: '800.00', interest: '80.00' });
    const figures = calc({ installments: [inst1, inst2], contractualRate: Percentage.of('3'), penaltyFromDate: daysAgo(40) });

    expect(figures.remainingSchedule).toHaveLength(1);
    expect(figures.remainingSchedule[0]?.totalDue.toString()).toBe('880.00');
  });

  it('computes Accrued Interest as (Total Past Due x Contractual Rate) / 30 x Days Late (Maturity -> accruedInterestAsOfDate)', () => {
    // Penalty deliberately left at 0 here (nothing recorded, RECORDED mode) so the assertion is
    // about the accrued-interest formula alone.
    const inst1 = installment(1, daysAgo(15), { principal: '900.00', interest: '100.00' });
    const figures = calc({
      installments: [inst1],
      contractualRate: Percentage.of('3'),
      penaltyMode: 'RECORDED',
      accruedInterestAsOfDate: daysFromNow(25),
    });

    expect(figures.totalPastDue.toString()).toBe('1000.00');
    // 1000.00 x 3% / 30 x 40 days (maturity = the only installment's due date, 15 days ago) = 40.00
    expect(figures.accruedInterest.toString()).toBe('40.00');
  });

  it('clamps Accrued Interest to 0 when accruedInterestAsOfDate has not yet reached the Maturity Date', () => {
    const inst1 = installment(1, daysAgo(15), { principal: '900.00', interest: '100.00' });
    const figures = calc({
      installments: [inst1],
      contractualRate: Percentage.of('3'),
      penaltyMode: 'RECORDED',
      accruedInterestAsOfDate: daysAgo(20),
    });

    expect(figures.accruedInterest.toString()).toBe('0.00');
  });
});

describe('StatementOfAccountCalculator - RECORDED penalty mode (2026-08-12)', () => {
  it("uses a migrated loan's frozen due.penalty, so the SOA matches its Repayment Schedule exactly", () => {
    const inst1 = installment(1, daysAgo(60), { principal: '26916.48', interest: '2437.62', penalty: '2935.41' });
    const inst2 = installment(2, daysAgo(30), { principal: '28108.86', interest: '1245.22' }); // nothing recorded

    const figures = calc({ installments: [inst1, inst2], penaltyMode: 'RECORDED' });

    // Exactly what the schedule shows: the one recorded figure, and nothing invented for the other.
    expect(figures.pastDuePenalty.toString()).toBe('2935.41');
  });

  it('needs no dates at all — passing a range changes nothing', () => {
    const inst1 = installment(1, daysAgo(60), { principal: '11000.00', interest: '0.00', penalty: '500.00' });

    const withRange = calc({ installments: [inst1], penaltyMode: 'RECORDED', penaltyFromDate: daysAgo(9999) });
    const withoutRange = calc({ installments: [inst1], penaltyMode: 'RECORDED' });

    expect(withRange.pastDuePenalty.toString()).toBe('500.00');
    expect(withoutRange.pastDuePenalty.toString()).toBe('500.00');
  });

  it("uses a prospective loan's live ADR-050 figure, matching PenaltyCalculator exactly", () => {
    const dueDate = new Date('2026-02-01T00:00:00Z');
    const asOf = new Date('2026-03-01T00:00:00Z'); // 28 days late
    const inst1 = installment(1, dueDate, { principal: '9000.00', interest: '1000.00' }); // 10,000 overdue -> 10%

    const figures = calc({
      installments: [inst1],
      penaltyMode: 'RECORDED',
      accruedInterestAsOfDate: asOf,
      penaltyContext: prospectiveContext(new Date('2026-08-01T00:00:00Z')),
    });

    // 10,000 x 10% / 30 x 28 days = 933.33 (flat 30 divisor as of 2026-08-12).
    expect(figures.pastDuePenalty.toString()).toBe('933.33');
  });

  it('caps a prospective loan at the maturity date rather than accruing forever', () => {
    const dueDate = new Date('2026-02-01T00:00:00Z');
    const maturityDate = new Date('2026-03-01T00:00:00Z');
    const inst1 = installment(1, dueDate, { principal: '9000.00', interest: '1000.00' });
    const context = prospectiveContext(maturityDate);

    const farPastMaturity = calc({
      installments: [inst1],
      penaltyMode: 'RECORDED',
      accruedInterestAsOfDate: daysFromNow(9999),
      penaltyContext: context,
    });
    const atMaturity = calc({
      installments: [inst1],
      penaltyMode: 'RECORDED',
      accruedInterestAsOfDate: maturityDate,
      penaltyContext: context,
    });

    expect(farPastMaturity.pastDuePenalty.toString()).toBe(atMaturity.pastDuePenalty.toString());
  });
});

describe('StatementOfAccountCalculator - COMPUTED penalty mode (2026-08-12)', () => {
  const FAR_MATURITY = daysFromNow(365);

  it('leaves an installment that already has a recorded penalty untouched', () => {
    const inst1 = installment(1, daysAgo(60), { principal: '11000.00', interest: '0.00', penalty: '777.77' });

    const figures = calc({
      installments: [inst1],
      penaltyMode: 'COMPUTED',
      penaltyFromDate: daysAgo(60),
      penaltyContext: migratedContext(FAR_MATURITY),
    });

    expect(figures.pastDuePenalty.toString()).toBe('777.77');
  });

  it('fills in only the installments that have none, keeping the recorded ones as they are', () => {
    const recorded = installment(1, daysAgo(60), { principal: '11000.00', interest: '0.00', penalty: '500.00' });
    const blank = installment(2, daysAgo(30), { principal: '11000.00', interest: '0.00' });

    const figures = calc({
      installments: [recorded, blank],
      penaltyMode: 'COMPUTED',
      penaltyFromDate: daysAgo(90),
      penaltyContext: migratedContext(FAR_MATURITY),
    });

    // 500.00 kept + blank computed from its OWN due date: 11,000 x 30 x (10%/30) = 1,100.00
    expect(figures.pastDuePenalty.toString()).toBe('1600.00');
  });

  it("counts each installment from its OWN due date, not one shared span", () => {
    const older = installment(1, daysAgo(60), { principal: '5000.00', interest: '0.00' });
    const newer = installment(2, daysAgo(30), { principal: '5000.00', interest: '0.00' });

    const figures = calc({
      installments: [older, newer],
      penaltyMode: 'COMPUTED',
      penaltyFromDate: daysAgo(90),
      penaltyContext: migratedContext(FAR_MATURITY),
    });

    // 5,000 x 60 x (5%/30) = 500.00, plus 5,000 x 30 x (5%/30) = 250.00. A single shared 90-day
    // span would have charged both 750.00 each.
    expect(figures.pastDuePenalty.toString()).toBe('750.00');
  });

  it('starts from penaltyFromDate when that is LATER than the due date (negotiated grace period)', () => {
    const inst1 = installment(1, daysAgo(60), { principal: '5000.00', interest: '0.00' });

    const figures = calc({
      installments: [inst1],
      penaltyMode: 'COMPUTED',
      penaltyFromDate: daysAgo(30),
      penaltyContext: migratedContext(FAR_MATURITY),
    });

    // Only the 30 days since the staff-chosen start: 5,000 x 30 x (5%/30) = 250.00
    expect(figures.pastDuePenalty.toString()).toBe('250.00');
  });

  it('charges nothing for an installment sitting ON the maturity date — penalty stops there', () => {
    const earlier = installment(1, daysAgo(60), { principal: '5000.00', interest: '0.00' });
    const atMaturity = installment(2, daysAgo(30), { principal: '5000.00', interest: '0.00' });

    // Maturity IS the second installment's due date, the real-world shape of every loan's last row.
    const figures = calc({
      installments: [earlier, atMaturity],
      penaltyMode: 'COMPUTED',
      penaltyFromDate: daysAgo(90),
      penaltyContext: migratedContext(atMaturity.dueDate),
    });

    // Only the first installment accrues, and only up to maturity: 5,000 x 30 x (5%/30) = 250.00.
    expect(figures.pastDuePenalty.toString()).toBe('250.00');
  });

  it('uses the SMALL BALANCE (5%) rate at or below the ₱10,000 per-installment threshold, 10% above it', () => {
    const small = installment(1, daysAgo(30), { principal: '10000.00', interest: '0.00' }); // exactly at the threshold
    const large = installment(1, daysAgo(30), { principal: '11000.00', interest: '0.00' });

    const smallFigures = calc({
      installments: [small],
      penaltyMode: 'COMPUTED',
      penaltyFromDate: daysAgo(60),
      penaltyContext: migratedContext(FAR_MATURITY),
    });
    const largeFigures = calc({
      installments: [large],
      penaltyMode: 'COMPUTED',
      penaltyFromDate: daysAgo(60),
      penaltyContext: migratedContext(FAR_MATURITY),
    });

    expect(smallFigures.pastDuePenalty.toString()).toBe('500.00'); // 10,000 x 30 x (5%/30)
    expect(largeFigures.pastDuePenalty.toString()).toBe('1100.00'); // 11,000 x 30 x (10%/30)
  });
});
