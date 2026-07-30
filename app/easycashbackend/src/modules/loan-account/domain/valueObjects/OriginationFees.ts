import { Money } from '@shared/domain/Money';

export interface OriginationFeesProps {
  processingFee: Money;
  advanceInterestFee: Money;
  outstandingBalancePayoff: Money;
  docStampFee: Money;
  accountManagementFee: Money;
  otherFees: Money;
  notarialFee: Money;
  webFee: Money;
  insuranceFee: Money;
}

/**
 * One-time deductions taken at disbursement — distinct from `LoanBalances`'
 * `feesBalance`/`feesPaid`/`feesDue`, which track recurring per-installment
 * fees. Staff-entered amounts (Create Loan Account form), not derived from a
 * fixed formula — see the Prisma `LoanAccount` model's own doc comment for
 * why (real legacy data shows too much per-loan variation to support one).
 * Set once at creation (LA-4-style snapshot), never recomputed later.
 */
export class OriginationFees {
  private constructor(private readonly props: OriginationFeesProps) {}

  static zero(): OriginationFees {
    return new OriginationFees({
      processingFee: Money.ZERO,
      advanceInterestFee: Money.ZERO,
      outstandingBalancePayoff: Money.ZERO,
      docStampFee: Money.ZERO,
      accountManagementFee: Money.ZERO,
      otherFees: Money.ZERO,
      notarialFee: Money.ZERO,
      webFee: Money.ZERO,
      insuranceFee: Money.ZERO,
    });
  }

  static of(props: OriginationFeesProps): OriginationFees {
    return new OriginationFees(props);
  }

  get processingFee(): Money {
    return this.props.processingFee;
  }

  get advanceInterestFee(): Money {
    return this.props.advanceInterestFee;
  }

  get outstandingBalancePayoff(): Money {
    return this.props.outstandingBalancePayoff;
  }

  get docStampFee(): Money {
    return this.props.docStampFee;
  }

  get accountManagementFee(): Money {
    return this.props.accountManagementFee;
  }

  get otherFees(): Money {
    return this.props.otherFees;
  }

  get notarialFee(): Money {
    return this.props.notarialFee;
  }

  get webFee(): Money {
    return this.props.webFee;
  }

  get insuranceFee(): Money {
    return this.props.insuranceFee;
  }

  /** Sum of all 9 components — subtracted from principal to get netProceeds. */
  total(): Money {
    return this.props.processingFee
      .add(this.props.advanceInterestFee)
      .add(this.props.outstandingBalancePayoff)
      .add(this.props.docStampFee)
      .add(this.props.accountManagementFee)
      .add(this.props.otherFees)
      .add(this.props.notarialFee)
      .add(this.props.webFee)
      .add(this.props.insuranceFee);
  }

  toProps(): Readonly<OriginationFeesProps> {
    return this.props;
  }
}
