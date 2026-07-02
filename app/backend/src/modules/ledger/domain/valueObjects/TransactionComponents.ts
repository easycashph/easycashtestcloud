import { Money } from '@shared/domain/Money';

export interface TransactionComponentsProps {
  principalComponent: Money;
  interestComponent: Money;
  feesComponent: Money;
  penaltyComponent: Money;
}

/** TXN-1..2: the principal/interest/fees/penalty split of a single transaction's amount. */
export class TransactionComponents {
  private constructor(private readonly props: TransactionComponentsProps) {}

  static of(props: Partial<TransactionComponentsProps>): TransactionComponents {
    return new TransactionComponents({
      principalComponent: props.principalComponent ?? Money.ZERO,
      interestComponent: props.interestComponent ?? Money.ZERO,
      feesComponent: props.feesComponent ?? Money.ZERO,
      penaltyComponent: props.penaltyComponent ?? Money.ZERO,
    });
  }

  get principalComponent(): Money {
    return this.props.principalComponent;
  }

  get interestComponent(): Money {
    return this.props.interestComponent;
  }

  get feesComponent(): Money {
    return this.props.feesComponent;
  }

  get penaltyComponent(): Money {
    return this.props.penaltyComponent;
  }

  sum(): Money {
    return this.principalComponent.add(this.interestComponent).add(this.feesComponent).add(this.penaltyComponent);
  }
}
