import type { LoanSigningSession } from '../../../domain/LoanSigningSession';

/** Never includes `tokenHash` (or anything the raw token could be derived from) - staff can see
 * status only, never the client's actual signing link. */
export function presentLoanSigningSessionStatus(session: LoanSigningSession) {
  const p = session.toProps();
  return {
    id: p.id,
    loanAccountId: p.loanAccountId,
    partyType: p.partyType,
    phoneNumber: p.phoneNumber,
    expiresAt: p.expiresAt.toISOString(),
    revokedAt: p.revokedAt?.toISOString() ?? null,
    otpVerifiedAt: p.otpVerifiedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    totalDocuments: p.documents.length,
    signedDocuments: p.documents.filter((d) => Boolean(d.signedAt)).length,
    fullySigned: p.documents.every((d) => Boolean(d.signedAt)),
  };
}
