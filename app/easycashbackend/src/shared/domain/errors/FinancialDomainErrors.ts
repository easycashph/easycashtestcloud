import { DomainError } from '@shared/errors/DomainError';

/**
 * Milestone 7 design review, final decision: Money construction throws a
 * typed DomainError on invalid input — Money's arithmetic methods
 * themselves stay pure/deterministic (see Money.ts), so the only place
 * "invalid" can occur is at the type boundary (construction), analogous to
 * a malformed value never being allowed to exist in the first place. This
 * is a type-invariant violation (programmer/input error), not a business
 * rule outcome, so it is thrown rather than returned as a Result.
 */
export class InvalidMoneyError extends DomainError {
  constructor(reason: string) {
    super('INVALID_MONEY', `Invalid monetary value: ${reason}`, undefined, 400);
    this.name = 'InvalidMoneyError';
  }
}

export class InvalidPercentageError extends DomainError {
  constructor(reason: string) {
    super('INVALID_PERCENTAGE', `Invalid percentage value: ${reason}`, undefined, 400);
    this.name = 'InvalidPercentageError';
  }
}
