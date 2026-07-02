import { Money } from '@shared/domain/Money';

export interface LoanBalancesProps {
  principalBalance: Money;
  principalPaid: Money;
  principalDue: Money;
  interestBalance: Money;
  interestPaid: Money;
  interestDue: Money;
  feesBalance: Money;
  feesPaid: Money;
  feesDue: Money;
  penaltyBalance: Money;
  penaltyPaid: Money;
  penaltyDue: Money;
}

/**
 * Wraps the 12 Decimal(14,2) balance fields on LoanAccount as one value
 * object, since they are always read and written together
 * (FINANCIAL_INVARIANTS.md §3) — never meaningfully mutated one field at a
 * time from outside a ledger-driven write. `zero()` is the only
 * constructor exposed at this milestone: a LoanAccount starts with no
 * balance activity until the (not-yet-built) calculation engine and
 * ledger-driven writes exist to populate it.
 */
export class LoanBalances {
  private constructor(private readonly props: LoanBalancesProps) {}

  static zero(): LoanBalances {
    return new LoanBalances({
      principalBalance: Money.ZERO,
      principalPaid: Money.ZERO,
      principalDue: Money.ZERO,
      interestBalance: Money.ZERO,
      interestPaid: Money.ZERO,
      interestDue: Money.ZERO,
      feesBalance: Money.ZERO,
      feesPaid: Money.ZERO,
      feesDue: Money.ZERO,
      penaltyBalance: Money.ZERO,
      penaltyPaid: Money.ZERO,
      penaltyDue: Money.ZERO,
    });
  }

  static of(props: LoanBalancesProps): LoanBalances {
    return new LoanBalances(props);
  }

  get principalBalance(): Money {
    return this.props.principalBalance;
  }

  get principalPaid(): Money {
    return this.props.principalPaid;
  }

  get principalDue(): Money {
    return this.props.principalDue;
  }

  get interestBalance(): Money {
    return this.props.interestBalance;
  }

  get interestPaid(): Money {
    return this.props.interestPaid;
  }

  get interestDue(): Money {
    return this.props.interestDue;
  }

  get feesBalance(): Money {
    return this.props.feesBalance;
  }

  get feesPaid(): Money {
    return this.props.feesPaid;
  }

  get feesDue(): Money {
    return this.props.feesDue;
  }

  get penaltyBalance(): Money {
    return this.props.penaltyBalance;
  }

  get penaltyPaid(): Money {
    return this.props.penaltyPaid;
  }

  get penaltyDue(): Money {
    return this.props.penaltyDue;
  }

  toProps(): Readonly<LoanBalancesProps> {
    return this.props;
  }
}
