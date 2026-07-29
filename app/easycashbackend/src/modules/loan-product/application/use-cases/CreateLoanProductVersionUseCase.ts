import { NotFoundError } from '@shared/errors/DomainError';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { LoanProductVersion } from '../../domain/LoanProductVersion';
import { PenaltyRule } from '../../domain/PenaltyRule';
import { FeeRule } from '../../domain/FeeRule';
import type { ILoanProductRepository } from '../ports/ILoanProductRepository';
import type { CreateLoanProductVersionInput } from '../dtos/LoanProductDtos';

export interface CreateLoanProductVersionUseCaseDeps {
  loanProductRepository: ILoanProductRepository;
}

/**
 * Creates a new, initially-INACTIVE version under an existing LoanProduct
 * (LPV-1). Activating it is a separate, explicit step
 * (ActivateLoanProductVersionUseCase) — creation never implies activation,
 * so LPV-2 is never at risk of being silently violated by this use case.
 */
export class CreateLoanProductVersionUseCase {
  constructor(private readonly deps: CreateLoanProductVersionUseCaseDeps) {}

  async execute(input: CreateLoanProductVersionInput): Promise<LoanProductVersion> {
    const product = await this.deps.loanProductRepository.findById(input.loanProductId);
    if (!product) {
      throw new NotFoundError('LoanProduct', input.loanProductId);
    }

    const version = LoanProductVersion.create({
      loanProductId: input.loanProductId,
      versionNumber: input.versionNumber,
      previousVersionId: input.previousVersionId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      interestCalculationMethod: input.interestCalculationMethod,
      repaymentPeriodUnit: input.repaymentPeriodUnit,
      loanAmountMin: Money.of(input.loanAmountMin),
      loanAmountMax: input.loanAmountMax ? Money.of(input.loanAmountMax) : undefined,
      loanAmountDefault: input.loanAmountDefault ? Money.of(input.loanAmountDefault) : undefined,
      installmentCountMin: input.installmentCountMin,
      installmentCountMax: input.installmentCountMax,
      installmentCountDefault: input.installmentCountDefault,
      gracePeriodDefaultDays: input.gracePeriodDefaultDays ?? 0,
      roundingMethod: input.roundingMethod,
      defaultInterestRate: input.defaultInterestRate ? Percentage.of(input.defaultInterestRate) : undefined,
      minInterestRate: input.minInterestRate ? Percentage.of(input.minInterestRate) : undefined,
      maxInterestRate: input.maxInterestRate ? Percentage.of(input.maxInterestRate) : undefined,
      legacyId: input.legacyId,
      penaltyRule: input.penaltyRule
        ? PenaltyRule.create({
            calculationMethod: input.penaltyRule.calculationMethod,
            ratePercent: input.penaltyRule.ratePercent ? Percentage.of(input.penaltyRule.ratePercent) : undefined,
            capPercent: input.penaltyRule.capPercent ? Percentage.of(input.penaltyRule.capPercent) : undefined,
            gracePeriodDays: input.penaltyRule.gracePeriodDays,
          })
        : undefined,
      feeRules: (input.feeRules ?? []).map((feeRuleInput) =>
        FeeRule.create({
          name: feeRuleInput.name,
          calculationMethod: feeRuleInput.calculationMethod,
          triggerEvent: feeRuleInput.triggerEvent,
          applicationType: feeRuleInput.applicationType,
          flatAmount: feeRuleInput.flatAmount ? Money.of(feeRuleInput.flatAmount) : undefined,
          percentage: feeRuleInput.percentage ? Percentage.of(feeRuleInput.percentage) : undefined,
        }),
      ),
    });

    product.addVersion(version);
    await this.deps.loanProductRepository.save(product);
    return version;
  }
}
