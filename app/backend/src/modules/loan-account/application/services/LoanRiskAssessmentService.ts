import type { LoanAccountStatus } from '../../domain/LoanAccount';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface LoanRiskAssessment {
  riskLevel: RiskLevel;
  maxDaysPastDue: number;
  lateInstallmentCount: number;
  recommendation: string;
}

const DPD_MEDIUM_THRESHOLD = 1;
const DPD_HIGH_THRESHOLD = 31;
const LATE_COUNT_MEDIUM_THRESHOLD = 1;
const LATE_COUNT_HIGH_THRESHOLD = 3;

const SEVERITY: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
function worse(a: RiskLevel, b: RiskLevel): RiskLevel {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Deterministic, rule-based loan-level risk classification — no external AI model, mirrors
 * LoanApplicationPreQualificationService's philosophy (system computes it, officer/collector still
 * decides what to do about it). Thresholds below are proposed defaults (industry-convention DPD
 * buckets), not yet business-confirmed the way the loan-application age/income/distance numbers
 * were — flagged for review, same as that feature's flat-rate constant was before it was final.
 *
 * `RepaymentInstallment.status` is a derived, live-computed getter (see that class's own doc
 * comment) — once an installment is fully paid its status becomes PAID regardless of whether it
 * was ever late, so "was this ever late" is inferred here by comparing `lastPaidAt` to `dueDate`
 * for settled installments, not read directly off `status`.
 */
export class LoanRiskAssessmentService {
  assess(input: { status: LoanAccountStatus; installments: RepaymentInstallment[] }): LoanRiskAssessment {
    const now = new Date();
    let maxDaysPastDue = 0;
    let lateInstallmentCount = 0;

    for (const installment of input.installments) {
      if (installment.status === 'LATE') {
        lateInstallmentCount += 1;
        maxDaysPastDue = Math.max(maxDaysPastDue, daysBetween(installment.dueDate, now));
      } else if (installment.status === 'PAID' && installment.lastPaidAt && installment.lastPaidAt > installment.dueDate) {
        lateInstallmentCount += 1;
      }
    }

    const dpdLevel: RiskLevel =
      maxDaysPastDue >= DPD_HIGH_THRESHOLD ? 'HIGH' : maxDaysPastDue >= DPD_MEDIUM_THRESHOLD ? 'MEDIUM' : 'LOW';
    const lateCountLevel: RiskLevel =
      lateInstallmentCount >= LATE_COUNT_HIGH_THRESHOLD
        ? 'HIGH'
        : lateInstallmentCount >= LATE_COUNT_MEDIUM_THRESHOLD
          ? 'MEDIUM'
          : 'LOW';

    let riskLevel = worse(dpdLevel, lateCountLevel);
    if (input.status === 'ACTIVE_IN_ARREARS' || input.status === 'CLOSED_WRITTEN_OFF') {
      riskLevel = 'HIGH';
    }

    return { riskLevel, maxDaysPastDue, lateInstallmentCount, recommendation: buildRecommendation(riskLevel, maxDaysPastDue, lateInstallmentCount) };
  }
}

function buildRecommendation(level: RiskLevel, maxDaysPastDue: number, lateInstallmentCount: number): string {
  if (level === 'HIGH') {
    return `${maxDaysPastDue} araw nang overdue ang pinaka-lumang balanse, ${lateInstallmentCount} late na installment sa kasaysayan ng account na ito. I-eskalate sa collections team para sa agarang follow-up.`;
  }
  if (level === 'MEDIUM') {
    return `May ${lateInstallmentCount} late na installment sa kasaysayan (${maxDaysPastDue} araw ang kasalukuyang pinaka-mataas na overdue). Katamtaman ang panganib — irekomenda ang regular na follow-up.`;
  }
  return 'Walang overdue balance at maayos ang kasaysayan ng bayaran. Mababa ang panganib batay sa kasalukuyang datos.';
}
