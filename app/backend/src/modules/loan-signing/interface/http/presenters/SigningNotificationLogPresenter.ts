import type { SigningNotificationLogRow } from '../../../application/ports/ISigningNotificationLogRepository';

export interface SigningNotificationLogResponse {
  id: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  type: SigningNotificationLogRow['type'];
  partyType: SigningNotificationLogRow['partyType'];
  channel: string;
  recipient: string;
  sentAt: string;
  verifiedAt: string | null;
}

export function presentSigningNotificationLog(row: SigningNotificationLogRow): SigningNotificationLogResponse {
  return {
    id: row.id,
    loanAccountId: row.loanAccountId,
    loanCode: row.loanCode,
    branchId: row.branchId,
    borrowerName: row.borrowerName,
    type: row.type,
    partyType: row.partyType,
    channel: row.channel,
    recipient: row.recipient,
    sentAt: row.sentAt.toISOString(),
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  };
}
