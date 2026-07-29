import { z } from 'zod';
import { decimalStringSchema } from '@shared/http/decimalValidation';

export const createLoanProductSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
});

export type CreateLoanProductRequestBody = z.infer<typeof createLoanProductSchema>;

/** Milestone 8.1 remediation (H-2): format-validated, not just non-empty — see shared/http/decimalValidation.ts. */
const decimalString = decimalStringSchema;

const createPenaltyRuleSchema = z.object({
  calculationMethod: z.enum(['NONE', 'OVERDUE_BALANCE_AND_INTEREST', 'ON_REPAYMENT']),
  ratePercent: decimalString.optional(),
  capPercent: decimalString.optional(),
  gracePeriodDays: z.coerce.number().int().min(0).optional(),
});

const createFeeRuleSchema = z.object({
  name: z.string().min(1),
  calculationMethod: z.enum(['FLAT', 'PERCENTAGE_OF_LOAN_AMOUNT']),
  triggerEvent: z.enum(['DISBURSEMENT', 'MANUAL', 'CAPITALIZED_DISBURSEMENT']),
  applicationType: z.enum(['REQUIRED', 'OPTIONAL']).optional(),
  flatAmount: decimalString.optional(),
  percentage: decimalString.optional(),
});

export const createLoanProductVersionSchema = z.object({
  versionNumber: z.coerce.number().int().positive(),
  previousVersionId: z.string().min(1).optional(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
  interestCalculationMethod: z.enum(['FLAT', 'DECLINING_BALANCE', 'DECLINING_BALANCE_DISCOUNTED']),
  repaymentPeriodUnit: z.enum(['MONTHS']).optional(),
  loanAmountMin: decimalString,
  loanAmountMax: decimalString.optional(),
  loanAmountDefault: decimalString.optional(),
  installmentCountMin: z.coerce.number().int().positive(),
  installmentCountMax: z.coerce.number().int().positive().optional(),
  installmentCountDefault: z.coerce.number().int().positive().optional(),
  gracePeriodDefaultDays: z.coerce.number().int().min(0).optional(),
  roundingMethod: z.enum(['NO_ROUNDING', 'ROUND_REMAINDER_INTO_LAST_REPAYMENT']).optional(),
  defaultInterestRate: decimalString.optional(),
  minInterestRate: decimalString.optional(),
  maxInterestRate: decimalString.optional(),
  legacyId: z.string().min(1).optional(),
  penaltyRule: createPenaltyRuleSchema.optional(),
  feeRules: z.array(createFeeRuleSchema).optional(),
});

export type CreateLoanProductVersionRequestBody = z.infer<typeof createLoanProductVersionSchema>;
