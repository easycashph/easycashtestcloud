import { randomUUID } from 'node:crypto';
import type { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import type { PenaltyRule } from './PenaltyRule';
import type { FeeRule } from './FeeRule';

export type InterestCalculationMethod = 'FLAT' | 'DECLINING_BALANCE' | 'DECLINING_BALANCE_DISCOUNTED';
export type RepaymentPeriodUnit = 'MONTHS';
export type RoundingMethod = 'NO_ROUNDING' | 'ROUND_REMAINDER_INTO_LAST_REPAYMENT';

export interface LoanProductVersionProps {
  id: string;
  loanProductId: string;
  versionNumber: number;
  previousVersionId?: string;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  interestCalculationMethod: InterestCalculationMethod;
  daysInYearConvention: string;
  repaymentPeriodUnit: RepaymentPeriodUnit;
  loanAmountMin: Money;
  loanAmountMax?: Money;
  loanAmountDefault?: Money;
  installmentCountMin: number;
  installmentCountMax?: number;
  installmentCountDefault?: number;
  gracePeriodDefaultDays: number;
  roundingMethod: RoundingMethod;
  /** ADR-009 PENDING: mechanism only — see FINANCIAL_INVARIANTS.md §8/§9. Never interpreted by this entity. */
  repaymentAllocationOrder?: unknown;
  defaultInterestRate?: Percentage;
  minInterestRate?: Percentage;
  maxInterestRate?: Percentage;
  legacyId?: string;
  createdAt: Date;
  updatedAt: Date;
  penaltyRule?: PenaltyRule;
  feeRules: FeeRule[];
}

export type CreateLoanProductVersionProps = Omit<
  LoanProductVersionProps,
  'id' | 'isActive' | 'createdAt' | 'updatedAt' | 'daysInYearConvention' | 'repaymentPeriodUnit' | 'roundingMethod' | 'feeRules'
> & {
  daysInYearConvention?: string;
  repaymentPeriodUnit?: RepaymentPeriodUnit;
  roundingMethod?: RoundingMethod;
  feeRules?: FeeRule[];
};

/**
 * Child entity of LoanProduct (ADR-042 §4) — never constructed or persisted
 * independently of its parent. `isActive` must only ever be flipped through
 * `LoanProduct.activateVersion()`, never directly, so LPV-2 stays
 * enforceable in exactly one place.
 */
export class LoanProductVersion {
  private props: LoanProductVersionProps;

  private constructor(props: LoanProductVersionProps) {
    this.props = props;
  }

  static create(input: CreateLoanProductVersionProps): LoanProductVersion {
    const now = new Date();
    return new LoanProductVersion({
      ...input,
      id: randomUUID(),
      isActive: false,
      daysInYearConvention: input.daysInYearConvention ?? 'E30_360',
      repaymentPeriodUnit: input.repaymentPeriodUnit ?? 'MONTHS',
      roundingMethod: input.roundingMethod ?? 'NO_ROUNDING',
      feeRules: input.feeRules ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: LoanProductVersionProps): LoanProductVersion {
    return new LoanProductVersion(props);
  }

  get id(): string {
    return this.props.id;
  }

  get loanProductId(): string {
    return this.props.loanProductId;
  }

  get versionNumber(): number {
    return this.props.versionNumber;
  }

  get previousVersionId(): string | undefined {
    return this.props.previousVersionId;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get effectiveFrom(): Date {
    return this.props.effectiveFrom;
  }

  get effectiveTo(): Date | undefined {
    return this.props.effectiveTo;
  }

  get interestCalculationMethod(): InterestCalculationMethod {
    return this.props.interestCalculationMethod;
  }

  get daysInYearConvention(): string {
    return this.props.daysInYearConvention;
  }

  get repaymentPeriodUnit(): RepaymentPeriodUnit {
    return this.props.repaymentPeriodUnit;
  }

  get loanAmountMin(): Money {
    return this.props.loanAmountMin;
  }

  get loanAmountMax(): Money | undefined {
    return this.props.loanAmountMax;
  }

  get loanAmountDefault(): Money | undefined {
    return this.props.loanAmountDefault;
  }

  get installmentCountMin(): number {
    return this.props.installmentCountMin;
  }

  get installmentCountMax(): number | undefined {
    return this.props.installmentCountMax;
  }

  get installmentCountDefault(): number | undefined {
    return this.props.installmentCountDefault;
  }

  get gracePeriodDefaultDays(): number {
    return this.props.gracePeriodDefaultDays;
  }

  get roundingMethod(): RoundingMethod {
    return this.props.roundingMethod;
  }

  get repaymentAllocationOrder(): unknown {
    return this.props.repaymentAllocationOrder;
  }

  get defaultInterestRate(): Percentage | undefined {
    return this.props.defaultInterestRate;
  }

  get minInterestRate(): Percentage | undefined {
    return this.props.minInterestRate;
  }

  get maxInterestRate(): Percentage | undefined {
    return this.props.maxInterestRate;
  }

  get legacyId(): string | undefined {
    return this.props.legacyId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get penaltyRule(): PenaltyRule | undefined {
    return this.props.penaltyRule;
  }

  get feeRules(): readonly FeeRule[] {
    return this.props.feeRules;
  }

  /** Package-internal — only LoanProduct.activateVersion()/deactivateAll() may call this, to keep LPV-2 enforceable in one place. */
  _setActive(isActive: boolean): void {
    this.props.isActive = isActive;
    this.props.updatedAt = new Date();
  }
}
