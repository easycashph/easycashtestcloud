/** Staff-side (authenticated) per-document status - see `ListLoanSigningSessionsUseCase`. */
export interface LoanSigningSessionDocumentStatus {
  id: string;
  name: string;
  signed: boolean;
}

/** Staff-side (authenticated) view of a signing session - see `ListLoanSigningSessionsUseCase` /
 * `LoanSigningSessionPresenter`. Never carries the raw link token, only status. `documents` is
 * only populated by the list endpoint - the create endpoint's response omits it (not rendered). */
export interface LoanSigningSessionStatus {
  id: string;
  loanAccountId: string;
  partyType: 'BORROWER' | 'CO_BORROWER';
  phoneNumber: string;
  expiresAt: string;
  revokedAt: string | null;
  otpVerifiedAt: string | null;
  createdAt: string;
  totalDocuments: number;
  signedDocuments: number;
  fullySigned: boolean;
  documents?: LoanSigningSessionDocumentStatus[];
}

export interface CreateLoanSigningSessionRequest {
  phoneNumber: string;
  partyType?: 'BORROWER' | 'CO_BORROWER';
}

/** Public (unauthenticated) client-facing view - see `GetLoanSigningSessionUseCase`. */
export interface SigningSessionDocumentView {
  id: string;
  name: string;
  sortIndex: number;
  signed: boolean;
}

export interface SigningSessionView {
  loanCode: string;
  borrowerName: string;
  otpVerified: boolean;
  fullySigned: boolean;
  documents: SigningSessionDocumentView[];
}
