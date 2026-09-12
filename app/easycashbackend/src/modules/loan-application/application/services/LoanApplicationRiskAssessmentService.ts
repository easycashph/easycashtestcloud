export type LoanApplicationRiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface LoanApplicationRiskAssessment {
  dtiPercent: number;
  riskTier: LoanApplicationRiskTier;
}

/**
 * Debt-to-income risk triage, computed once at submission time (2026-09-12, user request) so
 * staff can see who's Low/Medium/High risk the moment an applicant applies, without opening each
 * application. Thresholds confirmed by the user, matching the existing (frontend-only) Internal
 * Credit Score's own DTI bands: LOW <= 30%, MEDIUM 31-40%, HIGH > 40%.
 *
 * v1 deliberately covers only the new loan's own estimated amortization - NOT an applicant's other
 * active Easycash loans. Including those needs each loan's real per-installment amount from its
 * RepaymentSchedule; `LoanAccount`'s own product (LoanProduct.name, e.g. "SML-REG") doesn't map
 * onto the application's free-text `requestedCategory` (e.g. "Salary Loan"), so
 * computeFlatRateAmortization can't be reused for an already-booked loan without fabricating that
 * mapping. Flagged as a follow-up, not attempted here (CLAUDE.md: never fabricate financial logic).
 *
 * Returns undefined when there isn't enough data (no declared monthly income) - never guessed.
 */
export function assessLoanApplicationRisk(monthlyIncome: number | undefined, estimatedMonthlyAmortization: number): LoanApplicationRiskAssessment | undefined {
  if (!monthlyIncome || monthlyIncome <= 0) return undefined;

  const dtiPercent = (estimatedMonthlyAmortization / monthlyIncome) * 100;
  const riskTier: LoanApplicationRiskTier = dtiPercent <= 30 ? 'LOW' : dtiPercent <= 40 ? 'MEDIUM' : 'HIGH';
  return { dtiPercent, riskTier };
}
