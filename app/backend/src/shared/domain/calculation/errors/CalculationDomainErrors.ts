import { DomainError } from '@shared/errors/DomainError';

/**
 * Milestone 9.1 checkpoint 3: thrown at the construction/invocation
 * boundary of a calculation-engine function when an input violates a
 * documented Validation Rule from `docs/Architecture/CALCULATION_ENGINE_SPEC.md`
 * (e.g. a non-positive installment count, or a zero/negative rate for a
 * formula whose denominator would divide by zero). Mirrors
 * `InvalidMoneyError`/`InvalidPercentageError`
 * (`shared/domain/errors/FinancialDomainErrors.ts`) — a type/input-invariant
 * violation, not a business-rule outcome, thrown rather than returned as a
 * Result, consistent with Money/Percentage's Milestone 7 design decision.
 */
export class InvalidAmortizationInputError extends DomainError {
  constructor(reason: string) {
    super('INVALID_AMORTIZATION_INPUT', `Invalid amortization input: ${reason}`, undefined, 400);
    this.name = 'InvalidAmortizationInputError';
  }
}
