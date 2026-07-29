import { randomUUID } from 'node:crypto';
import type { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';

export type FeeCalculationMethod = 'FLAT' | 'PERCENTAGE_OF_LOAN_AMOUNT';
export type FeeTriggerEvent = 'DISBURSEMENT' | 'MANUAL' | 'CAPITALIZED_DISBURSEMENT';
export type FeeApplicationType = 'REQUIRED' | 'OPTIONAL';

export interface FeeRuleProps {
  id: string;
  name: string;
  calculationMethod: FeeCalculationMethod;
  triggerEvent: FeeTriggerEvent;
  applicationType: FeeApplicationType;
  flatAmount?: Money;
  percentage?: Percentage;
  isActive: boolean;
  legacyId?: string;
  createdAt: Date;
}

export interface CreateFeeRuleProps {
  name: string;
  calculationMethod: FeeCalculationMethod;
  triggerEvent: FeeTriggerEvent;
  applicationType?: FeeApplicationType;
  flatAmount?: Money;
  percentage?: Percentage;
  legacyId?: string;
}

/** FEE-1..4. Owned by exactly one LoanProductVersion — part of the immutable rule snapshot (LPV-1). */
export class FeeRule {
  private constructor(private props: FeeRuleProps) {}

  static create(input: CreateFeeRuleProps): FeeRule {
    return new FeeRule({
      id: randomUUID(),
      name: input.name,
      calculationMethod: input.calculationMethod,
      triggerEvent: input.triggerEvent,
      applicationType: input.applicationType ?? 'REQUIRED',
      flatAmount: input.flatAmount,
      percentage: input.percentage,
      isActive: true,
      legacyId: input.legacyId,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: FeeRuleProps): FeeRule {
    return new FeeRule(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get calculationMethod(): FeeCalculationMethod {
    return this.props.calculationMethod;
  }

  get triggerEvent(): FeeTriggerEvent {
    return this.props.triggerEvent;
  }

  get applicationType(): FeeApplicationType {
    return this.props.applicationType;
  }

  get flatAmount(): Money | undefined {
    return this.props.flatAmount;
  }

  get percentage(): Percentage | undefined {
    return this.props.percentage;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get legacyId(): string | undefined {
    return this.props.legacyId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  deactivate(): void {
    this.props.isActive = false;
  }
}
