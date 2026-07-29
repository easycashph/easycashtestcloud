import type {
  InterestCalculationMethod,
  RepaymentPeriodUnit,
  RoundingMethod,
} from '../../domain/LoanProductVersion';
import type { PenaltyCalculationMethod } from '../../domain/PenaltyRule';
import type { FeeApplicationType, FeeCalculationMethod, FeeTriggerEvent } from '../../domain/FeeRule';

export interface CreateLoanProductInput {
  code: string;
  name: string;
  description?: string;
}

export interface CreatePenaltyRuleInput {
  calculationMethod: PenaltyCalculationMethod;
  ratePercent?: string;
  capPercent?: string;
  gracePeriodDays?: number;
}

export interface CreateFeeRuleInput {
  name: string;
  calculationMethod: FeeCalculationMethod;
  triggerEvent: FeeTriggerEvent;
  applicationType?: FeeApplicationType;
  flatAmount?: string;
  percentage?: string;
}

export interface CreateLoanProductVersionInput {
  loanProductId: string;
  versionNumber: number;
  previousVersionId?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  interestCalculationMethod: InterestCalculationMethod;
  repaymentPeriodUnit?: RepaymentPeriodUnit;
  loanAmountMin: string;
  loanAmountMax?: string;
  loanAmountDefault?: string;
  installmentCountMin: number;
  installmentCountMax?: number;
  installmentCountDefault?: number;
  gracePeriodDefaultDays?: number;
  roundingMethod?: RoundingMethod;
  defaultInterestRate?: string;
  minInterestRate?: string;
  maxInterestRate?: string;
  legacyId?: string;
  penaltyRule?: CreatePenaltyRuleInput;
  feeRules?: CreateFeeRuleInput[];
}
