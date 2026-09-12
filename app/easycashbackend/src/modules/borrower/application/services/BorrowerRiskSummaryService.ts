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
  loanCode: string;
}

const ACTIVE_STATUSES: LoanAccountStatus[] = ['ACTIVE', 'ACTIVE_IN_ARREARS'];

const SEVERITY: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
function worse(a: RiskLevel, b: RiskLevel): RiskLevel {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

/**
 * Deterministic, rule-based client-level risk summary - aggregates
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
      // 2026-09-13 (user request, verified against a real case before shipping - see
      // "docs/session-logs/Office Server PC/SESSION_LOG_2026-09-13_semi_monthly_split_payment
      // _investigation.md"): Salary Loan borrowers commonly repay via a semi-monthly
      // payroll/allotment deduction - one nominal monthly installment is actually settled via two
      // roughly-equal partial payments about two weeks apart, so `lastPaidAt` (when the installment
      // was FULLY paid) lands ~13-15 days after that installment's own due date even when the
      // borrower never missed a payroll cycle. Confirmed every one of a real Salary Loan
      // borrower's non-final installments was fully settled before the NEXT installment's own due
      // date - "caught up before the next cycle" is what actually happened, not lateness. Scoped to
      // Salary Loan (`loanCode` starting with "SL-") only, on the user's explicit choice - Business/
      // Seafarer loans weren't confirmed to show this same allotment-driven pattern reliably enough
      // to trust the same relaxed rule for them. The last installment of a loan has no "next"
      // installment to lean on, so it keeps the strict same-due-date check either way.
      const isSalaryLoan = loan.loanCode.startsWith('SL-');
      const sortedInstallments = isSalaryLoan ? [...loan.installments].sort((a, b) => a.installmentNumber - b.installmentNumber) : loan.installments;
      for (let i = 0; i < sortedInstallments.length; i += 1) {
        const installment = sortedInstallments[i]!;
        if (installment.status !== 'PAID') continue;
        settledCount += 1;
        if (!installment.lastPaidAt) {
          onTimeCount += 1;
          continue;
        }
        const nextDueDate = isSalaryLoan ? sortedInstallments[i + 1]?.dueDate : undefined;
        const onTime = nextDueDate ? installment.lastPaidAt < nextDueDate : installment.lastPaidAt <= installment.dueDate;
        if (onTime) onTimeCount += 1;
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
  const rateText = ctx.onTimePaymentRate === null ? 'no payment history yet' : `${Math.round(ctx.onTimePaymentRate * 100)}% on-time`;
  if (level === 'HIGH') {
    return `${ctx.activeLoanCount} active loan(s) with ₱${ctx.totalExposure} exposure; ${rateText} track record. High risk - recommend close monitoring by the collections team.`;
  }
  if (level === 'MEDIUM') {
    return `${ctx.activeLoanCount} active loan(s) (₱${ctx.totalExposure} exposure), ${rateText}. Medium risk - regular follow-up recommended.`;
  }
  return `${ctx.activeLoanCount} active loan(s) (₱${ctx.totalExposure} exposure), ${rateText}. Low risk based on current data.`;
}
