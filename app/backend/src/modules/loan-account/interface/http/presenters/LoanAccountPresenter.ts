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

/** `isMatured` - computed separately (see `ListMaturedLoanAccountIdsUseCase`), not a domain field -
 * defaults to `false` for callers/tests that don't need it. See that use case's own doc comment
 * for the definition (Investopedia: full scheduled term over, still unpaid). */
export function presentLoanAccount(loanAccount: LoanAccount, isMatured = false) {
  const balances = loanAccount.balances.toProps();
  const originationFees = loanAccount.originationFees.toProps();
  return {
    id: loanAccount.id,
    /** 2026-07-22 (optimistic concurrency, client-facing) - the caller's own next edit must echo
     * this back as `expectedVersion` on `PATCH /loan-accounts/:id`. See
     * `UpdateLoanAccountInput.expectedVersion`'s doc comment. */
    version: loanAccount.version,
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
    anticipatedDisbursementDate: loanAccount.anticipatedDisbursementDate?.toISOString() ?? null,
    approvedAt: loanAccount.approvedAt?.toISOString() ?? null,
    approvedByUserId: loanAccount.approvedByUserId ?? null,
    activatedAt: loanAccount.activatedAt?.toISOString() ?? null,
    closedAt: loanAccount.closedAt?.toISOString() ?? null,
    closedReason: loanAccount.closedReason ?? null,
    legacyBalanceDataMissing: loanAccount.legacyBalanceDataMissing,
    legacyNonReconcilingClosedBalance: loanAccount.legacyNonReconcilingClosedBalance,
    originationFees: {
      processingFee: originationFees.processingFee.toString(),
      advanceInterestFee: originationFees.advanceInterestFee.toString(),
      outstandingBalancePayoff: originationFees.outstandingBalancePayoff.toString(),
      docStampFee: originationFees.docStampFee.toString(),
      accountManagementFee: originationFees.accountManagementFee.toString(),
      otherFees: originationFees.otherFees.toString(),
      notarialFee: originationFees.notarialFee.toString(),
      webFee: originationFees.webFee.toString(),
      insuranceFee: originationFees.insuranceFee.toString(),
    },
    netProceeds: loanAccount.netProceeds.toString(),
    legacyId: loanAccount.legacyId ?? null,
    createdAt: loanAccount.createdAt.toISOString(),
    updatedAt: loanAccount.updatedAt.toISOString(),
    appliedFees: loanAccount.appliedFees.map(presentAppliedFee),
    coBorrowerIds: [...loanAccount.coBorrowerIds],
    isMatured,
  };
}
