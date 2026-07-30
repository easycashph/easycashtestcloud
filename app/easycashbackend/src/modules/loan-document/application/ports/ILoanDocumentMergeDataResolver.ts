/**
 * ADR-051 §8: builds the `{Placeholder}` -> value map for a loan account, pulling together the
 * borrower, loan account, loan product, and repayment schedule. Kept behind a port (rather than
 * `GenerateLoanDocumentUseCase` depending directly on four different repositories) so the use case
 * only needs one collaborator for "give me this loan's document data."
 */
export interface ILoanDocumentMergeDataResolver {
  resolve(loanAccountId: string): Promise<Record<string, unknown>>;
}
