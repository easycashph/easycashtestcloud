/** Mirrors `app/backend`'s `LoanRiskAssessmentService`/`BorrowerRiskSummaryService` JSON shapes —
 * deterministic, rule-based (no external AI model), see those services' doc comments for the
 * exact formulas/thresholds. */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface LoanRiskAssessment {
  riskLevel: RiskLevel;
  maxDaysPastDue: number;
  lateInstallmentCount: number;
  recommendation: string;
}

export interface BorrowerRiskSummary {
  riskLevel: RiskLevel;
  activeLoanCount: number;
  totalExposure: string;
  worstDaysPastDue: number;
  lifetimeLateInstallmentCount: number;
  onTimePaymentRate: number | null;
  recommendation: string;
}
