import { Money } from '@shared/domain/Money';

export interface InstallmentAmountsProps {
  principal: Money;
  interest: Money;
  fees: Money;
  penalty: Money;
}

/** The principal/interest/fees/penalty split shared by both `*Due` and `*Paid` on a RepaymentInstallment. */
export class InstallmentAmounts {
  private constructor(private readonly props: InstallmentAmountsProps) {}

  static of(props: Partial<InstallmentAmountsProps>): InstallmentAmounts {
    return new InstallmentAmounts({
      principal: props.principal ?? Money.ZERO,
      interest: props.interest ?? Money.ZERO,
      fees: props.fees ?? Money.ZERO,
      penalty: props.penalty ?? Money.ZERO,
    });
  }

  get principal(): Money {
    return this.props.principal;
  }

  get interest(): Money {
    return this.props.interest;
  }

  get fees(): Money {
    return this.props.fees;
  }

  get penalty(): Money {
    return this.props.penalty;
  }

  total(): Money {
    return this.principal.add(this.interest).add(this.fees).add(this.penalty);
  }

  add(other: InstallmentAmounts): InstallmentAmounts {
    return InstallmentAmounts.of({
      principal: this.principal.add(other.principal),
      interest: this.interest.add(other.interest),
      fees: this.fees.add(other.fees),
      penalty: this.penalty.add(other.penalty),
    });
  }
}
