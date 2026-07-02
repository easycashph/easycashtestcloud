import { randomUUID } from 'node:crypto';
import type { Percentage } from '@shared/domain/Percentage';

export type PenaltyCalculationMethod = 'NONE' | 'OVERDUE_BALANCE_AND_INTEREST' | 'ON_REPAYMENT';

export interface PenaltyRuleProps {
  id: string;
  calculationMethod: PenaltyCalculationMethod;
  ratePercent?: Percentage;
  /** ADR-008 PENDING: mechanism only, not enforced anywhere yet — see FINANCIAL_INVARIANTS.md §8. */
  capPercent?: Percentage;
  gracePeriodDays: number;
}

export interface CreatePenaltyRuleProps {
  calculationMethod: PenaltyCalculationMethod;
  ratePercent?: Percentage;
  capPercent?: Percentage;
  gracePeriodDays?: number;
}

/** PEN-1..4. Owned by exactly one LoanProductVersion (1:1) — part of the immutable rule snapshot (LPV-1). */
export class PenaltyRule {
  private constructor(private readonly props: PenaltyRuleProps) {}

  static create(input: CreatePenaltyRuleProps): PenaltyRule {
    return new PenaltyRule({
      id: randomUUID(),
      calculationMethod: input.calculationMethod,
      ratePercent: input.ratePercent,
      capPercent: input.capPercent,
      gracePeriodDays: input.gracePeriodDays ?? 0,
    });
  }

  static reconstitute(props: PenaltyRuleProps): PenaltyRule {
    return new PenaltyRule(props);
  }

  get id(): string {
    return this.props.id;
  }

  get calculationMethod(): PenaltyCalculationMethod {
    return this.props.calculationMethod;
  }

  get ratePercent(): Percentage | undefined {
    return this.props.ratePercent;
  }

  get capPercent(): Percentage | undefined {
    return this.props.capPercent;
  }

  get gracePeriodDays(): number {
    return this.props.gracePeriodDays;
  }
}
