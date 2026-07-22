/** Staff-side (authenticated) view of a signing session - see `LoanSigningSessionPresenter`. Never
 * carries the raw link token, only status. */
export interface LoanSigningSessionStatus {
  id: string;
  loanAccountId: string;
  phoneNumber: string;
  expiresAt: string;
  revokedAt: string | null;
  otpVerifiedAt: string | null;
  createdAt: string;
  totalDocuments: number;
  signedDocuments: number;
  fullySigned: boolean;
}

export interface CreateLoanSigningSessionRequest {
  phoneNumber: string;
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
