import { DomainError } from '@shared/errors/DomainError';

/** 2026-07-15 (Reduce Penalty feature, user-confirmed): a reduction can never exceed what would otherwise be owed — it lowers the penalty, it never invents a higher one. */
export class PenaltyReductionExceedsCurrentAmountError extends DomainError {
  constructor(newAmount: string, currentAmount: string) {
    super(
      'PENALTY_REDUCTION_EXCEEDS_CURRENT_AMOUNT',
      `New penalty amount ${newAmount} must not exceed the current penalty ${currentAmount} — a reduction can only lower the amount owed.`,
      undefined,
      400,
    );
    this.name = 'PenaltyReductionExceedsCurrentAmountError';
  }
}

/** 2026-07-15 (Reduce Penalty feature, user-confirmed): penalty already paid is settled — reducing it would require a refund/credit disposition that was explicitly ruled out of scope. */
export class PenaltyAlreadyPaidError extends DomainError {
  constructor(installmentId: string) {
    super(
      'PENALTY_ALREADY_PAID',
      `Installment ${installmentId} has a paid penalty component — an already-paid penalty cannot be reduced.`,
      undefined,
      409,
    );
    this.name = 'PenaltyAlreadyPaidError';
  }
}

/** 2026-07-16 (Adjust Fees feature, user-confirmed): a new fees amount must be a non-negative figure — bidirectional (may raise or lower), unlike penalty, but never negative. */
export class InvalidFeesAdjustmentAmountError extends DomainError {
  constructor(newAmount: string) {
    super('INVALID_FEES_ADJUSTMENT_AMOUNT', `New fees amount ${newAmount} must not be negative.`, undefined, 400);
    this.name = 'InvalidFeesAdjustmentAmountError';
  }
}

/** 2026-07-16 (Adjust Fees feature, user-confirmed): fees already paid are settled — adjusting them would require a refund/credit disposition that was explicitly ruled out of scope, same rule as PenaltyAlreadyPaidError. */
export class FeesAlreadyPaidError extends DomainError {
  constructor(installmentId: string) {
    super(
      'FEES_ALREADY_PAID',
      `Installment ${installmentId} has a paid fees component — already-paid fees cannot be adjusted.`,
      undefined,
      409,
    );
    this.name = 'FeesAlreadyPaidError';
  }
}
