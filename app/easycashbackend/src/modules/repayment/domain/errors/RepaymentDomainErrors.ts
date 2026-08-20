import { DomainError } from '@shared/errors/DomainError';

/** 2026-08-05 (user-confirmed): the override may raise or lower the amount freely — the old ceiling
 * (couldn't exceed the live ADR-050/SEC-MC3-computed figure) was removed so staff can record a real
 * out-of-band approval that legitimately exceeds the formula. Only a negative amount is invalid. */
export class InvalidPenaltyAdjustmentAmountError extends DomainError {
  constructor(newAmount: string) {
    super('INVALID_PENALTY_ADJUSTMENT_AMOUNT', `New penalty amount ${newAmount} must not be negative.`, undefined, 400);
    this.name = 'InvalidPenaltyAdjustmentAmountError';
  }
}

/** 2026-07-15 (Reduce Penalty feature, user-confirmed) / 2026-08-20 (user-reported, BL-REG_Y813H,
 * narrowed): the already-PAID portion of a penalty is settled — bringing the new total BELOW what
 * was already collected would require a refund/credit disposition that was explicitly ruled out of
 * scope, and is still blocked. Bringing it down to (but not below) the paid amount - waiving only
 * the still-UNPAID remainder - is a normal case (a real out-of-band approval to forgive the rest of
 * a penalty after a partial payment) and is allowed as of 2026-08-20; see `reducePenalty()`'s own
 * doc comment. */
export class PenaltyAlreadyPaidError extends DomainError {
  constructor(installmentId: string, paidAmount: string) {
    super(
      'PENALTY_ALREADY_PAID',
      `Installment ${installmentId} already has ${paidAmount} paid toward its penalty — the new penalty amount cannot go below that.`,
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

/** 2026-08-15 (Add Fee feature, user-confirmed): a charge is strictly additive — must be a positive
 * amount. Zero or negative doesn't make sense as a NEW charge (a reduction goes through Adjust
 * Fees instead, which corrects the existing amount rather than adding to it). */
export class InvalidFeeChargeAmountError extends DomainError {
  constructor(amount: string) {
    super('INVALID_FEE_CHARGE_AMOUNT', `Fee charge amount ${amount} must be greater than zero.`, undefined, 400);
    this.name = 'InvalidFeeChargeAmountError';
  }
}

/** 2026-08-19 (Add Penalty feature, user-confirmed): mirrors InvalidFeeChargeAmountError — a manual
 * penalty charge is strictly additive, must be a positive amount. */
export class InvalidPenaltyChargeAmountError extends DomainError {
  constructor(amount: string) {
    super('INVALID_PENALTY_CHARGE_AMOUNT', `Penalty charge amount ${amount} must be greater than zero.`, undefined, 400);
    this.name = 'InvalidPenaltyChargeAmountError';
  }
}
