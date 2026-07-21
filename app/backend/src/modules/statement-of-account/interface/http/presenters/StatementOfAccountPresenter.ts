import type { GeneratedStatementOfAccount } from '../../../domain/GeneratedStatementOfAccount';
import type { GeneratedStatementOfAccountView } from '../../../application/ports/IGeneratedStatementOfAccountRepository';

export function presentGeneratedStatementOfAccount(statement: GeneratedStatementOfAccount) {
  return {
    id: statement.id,
    loanAccountId: statement.loanAccountId,
    soaNumber: statement.soaNumber,
    penaltyFromDate: statement.penaltyFromDate.toISOString().slice(0, 10),
    penaltyToDate: statement.penaltyToDate.toISOString().slice(0, 10),
    accruedInterestAsOfDate: statement.accruedInterestAsOfDate.toISOString().slice(0, 10),
    currentAmortizationDue: statement.currentAmortizationDue.toString(),
    pastDuePrincipal: statement.pastDuePrincipal.toString(),
    pastDueInterest: statement.pastDueInterest.toString(),
    pastDuePenalty: statement.pastDuePenalty.toString(),
    totalPastDue: statement.totalPastDue.toString(),
    accruedInterest: statement.accruedInterest.toString(),
    collectionFee: statement.collectionFee.toString(),
    otherFee: statement.otherFee.toString(),
    totalAmountDue: statement.totalAmountDue.toString(),
    generatedByUserId: statement.generatedByUserId,
    generatedAt: statement.generatedAt.toISOString(),
  };
}

export function presentStatementOfAccountListItem(item: GeneratedStatementOfAccountView) {
  return {
    id: item.id,
    loanAccountId: item.loanAccountId,
    soaNumber: item.soaNumber,
    penaltyFromDate: item.penaltyFromDate.toISOString().slice(0, 10),
    penaltyToDate: item.penaltyToDate.toISOString().slice(0, 10),
    accruedInterestAsOfDate: item.accruedInterestAsOfDate.toISOString().slice(0, 10),
    totalAmountDue: item.totalAmountDue,
    generatedByUserId: item.generatedByUserId,
    generatedByName: item.generatedByName,
    generatedAt: item.generatedAt.toISOString(),
  };
}
