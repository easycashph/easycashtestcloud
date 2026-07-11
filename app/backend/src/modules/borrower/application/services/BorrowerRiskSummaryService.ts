import { Money } from '@shared/domain/Money';
import type { LoanAccountStatus } from '@modules/loan-account/domain/LoanAccount';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { LoanRiskAssessmentService, type RiskLevel } from '@modules/loan-account/application/services/LoanRiskAssessmentService';

export interface BorrowerRiskSummary {
  riskLevel: RiskLevel;
  activeLoanCount: number;
  totalExposure: string;
  worstDaysPastDue: number;
  lifetimeLateInstallmentCount: number;
  /** null if the borrower has no settled installments across any loan yet (e.g. brand-new). */
  onTimePaymentRate: number | null;
  recommendation: string;
}

export interface BorrowerLoanInput {
  status: LoanAccountStatus;
  collectionsBalance: Money;
  installments: RepaymentInstallment[];
}

const ACTIVE_STATUSES: LoanAccountStatus[] = ['ACTIVE', 'ACTIVE_IN_ARREARS'];

const SEVERITY: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
function worse(a: RiskLevel, b: RiskLevel): RiskLevel {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

/**
 * Deterministic, rule-based client-level risk summary — aggregates
 * LoanRiskAssessmentService's per-loan output across a borrower's whole loan history. Combines two
 * signals per this session's decision: the worst risk level among currently active loans, and the
 * borrower's lifetime on-time-payment track record (including closed loans). Thresholds below are
 * proposed defaults, same review posture as LoanRiskAssessmentService's.
 */
export class BorrowerRiskSummaryService {
  constructor(private readonly loanRiskAssessmentService: LoanRiskAssessmentService) {}

  summarize(loans: BorrowerLoanInput[]): BorrowerRiskSummary {
    const activeLoans = loans.filter((l) => ACTIVE_STATUSES.includes(l.status));

    const perLoanAssessments = loans.map((l) => ({
      loan: l,
      assessment: this.loanRiskAssessmentService.assess({ status: l.status, installments: l.installments }),
    }));

    const activeAssessments = perLoanAssessments.filter((p) => ACTIVE_STATUSES.includes(p.loan.status));
    const worstActiveRisk: RiskLevel = activeAssessments.reduce<RiskLevel>(
      (acc, p) => worse(acc, p.assessment.riskLevel),
      'LOW',
    );
    const worstDaysPastDue = activeAssessments.reduce((max, p) => Math.max(max, p.assessment.maxDaysPastDue), 0);
    const lifetimeLateInstallmentCount = perLoanAssessments.reduce((sum, p) => sum + p.assessment.lateInstallmentCount, 0);

    let settledCount = 0;
    let onTimeCount = 0;
    for (const loan of loans) {
      for (const installment of loan.installments) {
        if (installment.status === 'PAID') {
          settledCount += 1;
          if (!installment.lastPaidAt || installment.lastPaidAt <= installment.dueDate) onTimeCount += 1;
        }
      }
    }
    const onTimePaymentRate = settledCount > 0 ? onTimeCount / settledCount : null;
    const trackRecordRisk: RiskLevel =
      onTimePaymentRate === null ? 'MEDIUM' : onTimePaymentRate >= 0.9 ? 'LOW' : onTimePaymentRate >= 0.7 ? 'MEDIUM' : 'HIGH';

    const riskLevel = worse(worstActiveRisk, trackRecordRisk);
    const totalExposure = activeLoans.reduce((sum, l) => sum.add(l.collectionsBalance), Money.ZERO);

    return {
      riskLevel,
      activeLoanCount: activeLoans.length,
      totalExposure: totalExposure.toString(),
      worstDaysPastDue,
      lifetimeLateInstallmentCount,
      onTimePaymentRate,
      recommendation: buildRecommendation(riskLevel, {
        activeLoanCount: activeLoans.length,
        totalExposure: totalExposure.toString(),
        onTimePaymentRate,
      }),
    };
  }
}

function buildRecommendation(
  level: RiskLevel,
  ctx: { activeLoanCount: number; totalExposure: string; onTimePaymentRate: number | null },
): string {
  const rateText = ctx.onTimePaymentRate === null ? 'wala pang kasaysayan ng bayaran' : `${Math.round(ctx.onTimePaymentRate * 100)}% on-time`;
  if (level === 'HIGH') {
    return `${ctx.activeLoanCount} aktibong loan na may ₱${ctx.totalExposure} na exposure; ${rateText} sa track record. Mataas ang panganib — irekomenda ang malapit na pagsubaybay ng collections team.`;
  }
  if (level === 'MEDIUM') {
    return `${ctx.activeLoanCount} aktibong loan (₱${ctx.totalExposure} exposure), ${rateText}. Katamtaman ang panganib — regular na follow-up.`;
  }
  return `${ctx.activeLoanCount} aktibong loan (₱${ctx.totalExposure} exposure), ${rateText}. Mababa ang panganib batay sa kasalukuyang datos.`;
}
