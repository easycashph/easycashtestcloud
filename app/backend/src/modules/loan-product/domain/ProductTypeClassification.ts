/**
 * Backend mirror of the frontend's `productTypeClassification.ts` — kept deliberately in sync
 * (same prefix table, same "name not code" reasoning) since both need to agree on what counts as a
 * Seafarer Loan for `TagLoanApplicationPreApprovalUseCase`'s Agency Verification gate.
 */
const SEAFARER_LOAN_NAME_PREFIX = 'SML-';

export function isSeafarerLoanProductName(productName: string): boolean {
  return productName.toUpperCase().startsWith(SEAFARER_LOAN_NAME_PREFIX);
}
