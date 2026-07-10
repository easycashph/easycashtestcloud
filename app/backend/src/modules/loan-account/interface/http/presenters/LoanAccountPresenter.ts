import type { LoanAccount } from '../../../domain/LoanAccount';
import type { AppliedFee } from '../../../domain/AppliedFee';

/** Milestone 8 / D-5: the only place LoanAccount/AppliedFee become JSON-safe — Money/Percentage/Date formatting never happens in the controller. */
function presentAppliedFee(fee: AppliedFee) {
  return {
    id: fee.id,
    feeRuleId: fee.feeRuleId,
    amount: fee.amount.toString(),
    taxAmount: fee.taxAmount.toString(),
    appliedAt: fee.appliedAt.toISOString(),
    transactionId: fee.transactionId ?? null,
  };
}

export function presentLoanAccount(loanAccount: LoanAccount) {
  const balances = loanAccount.balances.toProps();
  return {
    id: loanAccount.id,
    loanCode: loanAccount.loanCode,
    borrowerId: loanAccount.borrowerId,
    loanProductVersionId: loanAccount.loanProductVersionId,
    branchId: loanAccount.branchId,
    loanOfficerId: loanAccount.loanOfficerId ?? null,
    status: loanAccount.status,
    principalAmount: loanAccount.principalAmount.toString(),
    balances: {
      principalBalance: balances.principalBalance.toString(),
      principalPaid: balances.principalPaid.toString(),
      principalDue: balances.principalDue.toString(),
      interestBalance: balances.interestBalance.toString(),
      interestPaid: balances.interestPaid.toString(),
      interestDue: balances.interestDue.toString(),
      feesBalance: balances.feesBalance.toString(),
      feesPaid: balances.feesPaid.toString(),
      feesDue: balances.feesDue.toString(),
      penaltyBalance: balances.penaltyBalance.toString(),
      penaltyPaid: balances.penaltyPaid.toString(),
      penaltyDue: balances.penaltyDue.toString(),
    },
    // Milestone 9.1 checkpoint 11 / ADR-007 §3 (RESOLVED, Option B): both
    // summary totals exposed, distinctly named — neither is "outstandingBalance".
    collectionsBalance: loanAccount.collectionsBalance.toString(),
    accountingBalance: loanAccount.accountingBalance.toString(),
    interestRate: loanAccount.interestRate.toString(),
    addOnInterestRate: loanAccount.addOnInterestRate?.toString() ?? null,
    contractualInterestRate: loanAccount.contractualInterestRate?.toString() ?? null,
    installmentCount: loanAccount.installmentCount,
    repaymentPeriodUnit: loanAccount.repaymentPeriodUnit,
    gracePeriodDays: loanAccount.gracePeriodDays,
    firstRepaymentDate: loanAccount.firstRepaymentDate.toISOString(),
    approvedAt: loanAccount.approvedAt?.toISOString() ?? null,
    approvedByUserId: loanAccount.approvedByUserId ?? null,
    activatedAt: loanAccount.activatedAt?.toISOString() ?? null,
    closedAt: loanAccount.closedAt?.toISOString() ?? null,
    closedReason: loanAccount.closedReason ?? null,
    legacyBalanceDataMissing: loanAccount.legacyBalanceDataMissing,
    legacyId: loanAccount.legacyId ?? null,
    createdAt: loanAccount.createdAt.toISOString(),
    updatedAt: loanAccount.updatedAt.toISOString(),
    appliedFees: loanAccount.appliedFees.map(presentAppliedFee),
    coBorrowerIds: [...loanAccount.coBorrowerIds],
  };
}
