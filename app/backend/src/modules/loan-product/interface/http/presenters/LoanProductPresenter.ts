import type { LoanProduct } from '../../../domain/LoanProduct';
import type { LoanProductVersion } from '../../../domain/LoanProductVersion';
import type { PenaltyRule } from '../../../domain/PenaltyRule';
import type { FeeRule } from '../../../domain/FeeRule';

/** Milestone 8 / D-5: the only place LoanProduct/LoanProductVersion/PenaltyRule/FeeRule become JSON-safe — Money/Percentage/Date formatting never happens in the controller. */
function presentPenaltyRule(penaltyRule: PenaltyRule) {
  return {
    id: penaltyRule.id,
    calculationMethod: penaltyRule.calculationMethod,
    ratePercent: penaltyRule.ratePercent?.toString() ?? null,
    capPercent: penaltyRule.capPercent?.toString() ?? null,
    gracePeriodDays: penaltyRule.gracePeriodDays,
  };
}

function presentFeeRule(feeRule: FeeRule) {
  return {
    id: feeRule.id,
    name: feeRule.name,
    calculationMethod: feeRule.calculationMethod,
    triggerEvent: feeRule.triggerEvent,
    applicationType: feeRule.applicationType,
    flatAmount: feeRule.flatAmount?.toString() ?? null,
    percentage: feeRule.percentage?.toString() ?? null,
    isActive: feeRule.isActive,
    legacyId: feeRule.legacyId ?? null,
    createdAt: feeRule.createdAt.toISOString(),
  };
}

function presentLoanProductVersion(version: LoanProductVersion) {
  return {
    id: version.id,
    loanProductId: version.loanProductId,
    versionNumber: version.versionNumber,
    previousVersionId: version.previousVersionId ?? null,
    isActive: version.isActive,
    effectiveFrom: version.effectiveFrom.toISOString(),
    effectiveTo: version.effectiveTo?.toISOString() ?? null,
    interestCalculationMethod: version.interestCalculationMethod,
    daysInYearConvention: version.daysInYearConvention,
    repaymentPeriodUnit: version.repaymentPeriodUnit,
    loanAmountMin: version.loanAmountMin.toString(),
    loanAmountMax: version.loanAmountMax?.toString() ?? null,
    loanAmountDefault: version.loanAmountDefault?.toString() ?? null,
    installmentCountMin: version.installmentCountMin,
    installmentCountMax: version.installmentCountMax ?? null,
    installmentCountDefault: version.installmentCountDefault ?? null,
    gracePeriodDefaultDays: version.gracePeriodDefaultDays,
    roundingMethod: version.roundingMethod,
    defaultInterestRate: version.defaultInterestRate?.toString() ?? null,
    minInterestRate: version.minInterestRate?.toString() ?? null,
    maxInterestRate: version.maxInterestRate?.toString() ?? null,
    legacyId: version.legacyId ?? null,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
    penaltyRule: version.penaltyRule ? presentPenaltyRule(version.penaltyRule) : null,
    feeRules: version.feeRules.map(presentFeeRule),
  };
}

export function presentLoanProduct(loanProduct: LoanProduct) {
  return {
    id: loanProduct.id,
    code: loanProduct.code,
    name: loanProduct.name,
    description: loanProduct.description ?? null,
    createdAt: loanProduct.createdAt.toISOString(),
    updatedAt: loanProduct.updatedAt.toISOString(),
    versions: loanProduct.versions.map(presentLoanProductVersion),
  };
}
